// ==========================================
// [Part 1] 매칭 및 캐릭터 선택 시스템
// ==========================================

let myRole = null;       // 'host' or 'guest'
let currentRoomId = null; 
let isMyTurn = false;    
let selectedCharKey = null; 
let game = null; // [수정] 게임 변수를 전역으로 선언 (이게 없어서 에러가 났습니다!)

const lobbyScreen = document.getElementById('lobby-screen');
const charSelectScreen = document.getElementById('char-select-screen');
const gameContainer = document.getElementById('game-container');
const statusMsg = document.getElementById('status-msg');
const matchBtn = document.getElementById('find-match-btn');

window.selectedChars = { host: null, guest: null };

matchBtn.addEventListener('click', () => {
    if (!window.db) { alert("Firebase 설정이 필요합니다!"); return; }
    matchBtn.disabled = true;
    matchBtn.innerText = "찾는 중...";
    statusMsg.innerText = "대기 중인 방을 검색합니다...";
    findMatch();
});

function findMatch() {
    const roomsRef = window.dbRef(window.db, 'rooms');
    window.dbGet(roomsRef).then((snapshot) => {
        const rooms = snapshot.val();
        let foundRoom = null;
        if (rooms) {
            for (let id in rooms) {
                if (rooms[id].status === 'waiting') {
                    foundRoom = id;
                    break;
                }
            }
        }
        if (foundRoom) joinRoom(foundRoom);
        else createRoom();
    });
}

function createRoom() {
    const newRoomRef = window.dbPush(window.dbRef(window.db, 'rooms'));
    currentRoomId = newRoomRef.key;
    myRole = 'host';

    const hostRoll = Math.floor(Math.random() * 100);
    const guestRoll = Math.floor(Math.random() * 100);
    let firstTurn = (hostRoll >= guestRoll) ? 'host' : 'guest';

    window.dbSet(newRoomRef, {
        status: 'waiting',
        turn: firstTurn, 
        hostRoll: hostRoll,
        guestRoll: guestRoll,
        hostUnit: null, guestUnit: null
    });

    statusMsg.innerText = "방 생성 완료! 상대를 기다립니다...";

    window.dbOnValue(newRoomRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.status === 'selecting') onMatchFound();
    });
}

function joinRoom(roomId) {
    currentRoomId = roomId;
    myRole = 'guest';
    const roomRef = window.dbRef(window.db, 'rooms/' + roomId);
    window.dbUpdate(roomRef, { status: 'selecting' }); 
    statusMsg.innerText = "상대 발견! 캐릭터 선택 화면으로...";
    onMatchFound();
}

function onMatchFound() {
    lobbyScreen.style.display = 'none';
    startCharSelectUI();
}

function startCharSelectUI() {
    charSelectScreen.style.display = 'flex';
    const charGrid = document.getElementById('char-grid');
    const lockInBtn = document.getElementById('lock-in-btn');

    charGrid.innerHTML = '';
    Object.keys(DB.CHARACTERS).forEach(key => {
        const char = DB.CHARACTERS[key];
        const btn = document.createElement('div');
        btn.style.cssText = `width: 90px; height: 90px; background: ${char.color}; border: 2px solid #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; text-shadow: 1px 1px 2px black; font-size: 14px; text-align: center;`;
        btn.innerText = char.name;
        
        btn.onclick = () => {
            if (lockInBtn.disabled === false && lockInBtn.innerText === "LOCKED") return;
            selectedCharKey = key;
            const roleKey = (myRole === 'host') ? 'hostSelect' : 'guestSelect';
            window.dbUpdate(window.dbRef(window.db, `rooms/${currentRoomId}`), { [roleKey]: key });
            updatePortrait(myRole, key);
            lockInBtn.disabled = false;
            lockInBtn.style.opacity = 1;
        };
        charGrid.appendChild(btn);
    });

    lockInBtn.onclick = () => {
        lockInBtn.innerText = "LOCKED";
        lockInBtn.style.background = "#555";
        lockInBtn.disabled = true;
        const roleKey = (myRole === 'host') ? 'hostReady' : 'guestReady';
        const charKeyField = (myRole === 'host') ? 'hostChar' : 'guestChar';
        window.dbUpdate(window.dbRef(window.db, `rooms/${currentRoomId}`), {
            [roleKey]: true, [charKeyField]: selectedCharKey
        });
    };

    const roomRef = window.dbRef(window.db, `rooms/${currentRoomId}`);
    window.dbOnValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        if (myRole === 'host') {
            if (data.guestSelect) updatePortrait('guest', data.guestSelect);
            if (data.guestReady) markReady('guest');
        } else {
            if (data.hostSelect) updatePortrait('host', data.hostSelect);
            if (data.hostReady) markReady('host');
        }

        if (data.hostReady && data.guestReady && data.status !== 'playing') {
            if (myRole === 'host') {
                window.dbUpdate(roomRef, { 
                    status: 'playing',
                    hostUnit: { ...DB.CHARACTERS[data.hostChar], x: 3, y: 8, currentMove: 0, mp: 0, arrows: 0 }, 
                    guestUnit: { ...DB.CHARACTERS[data.guestChar], x: 3, y: 1, currentMove: 0, mp: 0, arrows: 0 }
                });
            }
        }
        
        if (data.status === 'playing') {
            window.selectedChars.host = data.hostChar;
            window.selectedChars.guest = data.guestChar;
            setTimeout(() => {
                charSelectScreen.style.display = 'none';
                startGameUI();
            }, 1000);
        }
    });
}

function updatePortrait(role, charKey) {
    const targetId = (role === 'host') ? 'p1' : 'p2';
    const charData = DB.CHARACTERS[charKey];
    document.getElementById(`${targetId}-portrait`).style.backgroundColor = charData.color;
    document.getElementById(`${targetId}-portrait`).innerHTML = `<span style="font-size:30px; font-weight:bold;">${charData.name}</span>`;
    document.getElementById(`${targetId}-name`).innerText = charData.name;
}

function markReady(role) {
    const targetId = (role === 'host') ? 'p1' : 'p2';
    document.getElementById(`${targetId}-name`).innerText = "READY!";
    document.getElementById(`${targetId}-name`).style.color = "#FFD700";
}

function startGameUI() {
    gameContainer.style.display = 'block';
    // [수정] 변수 이름을 game으로 통일했습니다.
    if (!game) game = new Phaser.Game(config);
}


// ==========================================
// [Part 2] 인게임 로직 (Game Logic)
// ==========================================

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 800,
    height: 600,
    backgroundColor: '#2d2d2d',
    scene: { preload: preload, create: create, update: update }
};

// === [데이터베이스] ===
const DB = {
    SKILLS: {
        // [기사]
        SLASH: { name: "베기", power: 25, range: 3, cooldown: 0, cost: 0, desc: "기본 공격" },
        UPPER_SLASH: { name: "상단 베기", power: 50, range: 2, cooldown: 3, cost: 0, desc: "강력한 일격" },
        GUARD: { name: "가드", type: "buff", cooldown: 2, reduction: 0.3, cost: 0, desc: "방어 태세" },
        SHIELD_THROW: { name: "방패 던지기", power: 10, range: 4, triggerReAction: true, maxUse: 1, isUltimate: true, cost: 0, desc: "[궁극기] 재행동" },
        
        // [마법사]
        MAGIC_MISSILE: { name: "매직미사일", power: 20, range: 5, cost: 10, cooldown: 0, desc: "[평타] MP 10" },
        FIREBALL: { name: "파이어볼", power: 30, range: 5, cost: 20, cooldown: 2, desc: "화염 (MP 20)" },
        ICE_SPEAR: { name: "아이스 스피어", power: 35, range: 4, cost: 20, cooldown: 2, desc: "얼음 (MP 20)" },
        INFERNITY: { name: "인페르니티", power: 110, range: 8, cost: 100, cooldown: 5, isUltimate: true, disablePassive: 1, desc: "[궁극기] MP 100, 패시브 봉인" },

        // [닌자]
        DIAGONAL_SLASH: { name: "사선베기", power: 25, range: 2, cooldown: 0, cost: 0, extraMove: 3, desc: "공격 후 3칸 이동" },
        STEALTH: { name: "은신", type: "buff", range: 0, cooldown: 4, cost: 0, triggerReAction: true, effect: "stealth", desc: "은신 & 재행동" },
        KUNAI_THROW: { name: "쿠나이", power: 25, range: 4, cooldown: 0, cost: 0, extraMove: 3, desc: "원거리 후 3칸 이동" },
        BACKSTAB: { name: "배후노리기", power: 60, range: 6, cooldown: 0, cost: 0, isUltimate: true, reqStealth: true, teleportBehind: true, extraMove: 1, desc: "[궁극기] 은신 필요, 적 뒤로 이동 (사거리 6)" },

        // [보우 마스터]
        SNIPE: { name: "저격", power: 20, range: 6, minRange: 4, cooldown: 0, cost: 0, desc: "장거리 사격 (4-6칸)" },
        AIM: { name: "조준", type: "buff", range: 0, cooldown: 0, cost: 0, triggerReAction: true, effect: "aim", desc: "다음 저격 강화, 이동 불가" },
        BACKSTEP: { name: "백스텝", power: 0, range: 0, cooldown: 2, cost: 0, triggerReAction: true, effect: "backstep", desc: "뒤로 2칸 이동 & 재행동" },
        HEADSHOT: { name: "헤드샷", power: 70, range: 7, minRange: 5, cooldown: 6, cost: 0, isUltimate: true, chargeTurn: 1, desc: "[궁극기] 1턴 차징 후 발사" },

        // [패스파인더]
        DAGGER_STAB: { name: "단검 찌르기", power: 20, range: 2, cooldown: 0, cost: 0, desc: "기본 공격" },
        PATH_DETECT: { name: "경로 탐지", type: "buff", range: 0, cooldown: 2, cost: 0, effect: "detect", desc: "거리3배수:기습3배 / 2배수:단검+10" },
        PATH_SET: { name: "경로 설정", type: "buff", range: 14, cooldown: 4, cost: 0, triggerReAction: true, effect: "pathset", minDist: 10, desc: "거리10이상: 이속+7, 적 위치 강제 이동" },
        CROSSBOW_SURGE: { name: "석궁 쇄도", power: 10, range: 5, cooldown: 4, cost: 0, isUltimate: true, reqAmbush: true, desc: "[궁극기] 화살x10 데미지. 기습 이력 필요." }
    },
    PASSIVES: {
        KNIGHT_SHIELD: { name: "기사의 방패", rate: 0.3, reduction: 0.2, maxCount: 1, type: "defense" },
        MANA_MASTER: { name: "마나의 주인", type: "regen", amount: 30, desc: "매 턴 MP 30 회복" },
        STEALTH_ART: { name: "은신술", type: "state", desc: "은신 시 이동력 증가" },
        CRITICAL_HIT: { name: "크리티컬", type: "attack", rate: 0.05, multiplier: 1.5, desc: "5% 확률로 1.5배 데미지" },
        PATHFINDER_KIT: { name: "패스파인더", type: "hybrid", desc: "1. 기습(8칸이동시 2배) 2. 화살줍기(4칸당+1)" }
    },
    CHARACTERS: {
        KNIGHT: { name: "기사", hp: 120, mp: 0, move: [3, 4], skills: ["SLASH", "UPPER_SLASH", "GUARD", "SHIELD_THROW"], passive: "KNIGHT_SHIELD", color: '#C0C0C0' },
        MAGE: { name: "마법사", hp: 100, mp: 100, move: [2, 4], skills: ["MAGIC_MISSILE", "FIREBALL", "ICE_SPEAR", "INFERNITY"], passive: "MANA_MASTER", color: '#9C27B0' },
        NINJA: { name: "닌자", hp: 85, mp: 0, move: [4, 5], skills: ["DIAGONAL_SLASH", "STEALTH", "KUNAI_THROW", "BACKSTAB"], passive: "STEALTH_ART", color: '#333333' },
        BOW_MASTER: { name: "보우 마스터", hp: 100, mp: 0, move: [3, 4], skills: ["SNIPE", "AIM", "BACKSTEP", "HEADSHOT"], passive: "CRITICAL_HIT", color: '#228B22' },
        PATHFINDER: { name: "패스파인더", hp: 70, mp: 0, move: [4, 7], skills: ["DAGGER_STAB", "PATH_DETECT", "PATH_SET", "CROSSBOW_SURGE"], passive: "PATHFINDER_KIT", color: '#FF4500' }
    }
};

let mapData = [], visualGrid = [];
const mapWidth = 7, mapHeight = 9, gridSize = 60;
let playerUnit, enemyUnit; 
let gameState = 0; 
let statusText, actionMenuGroup;
let moveHighlights = [];
let tempX, tempY, selectedSkill;
let turnCount = 1;

const STATE = { IDLE: 0, MOVE: 1, ACTION: 2, TARGET: 3, BUSY: 4, ENEMY_TURN: 5, CHARGING: 6, ENEMY_MOVE_SELECT: 7 };

// === 유닛 클래스 ===
class Unit {
    constructor(scene, data, x, y, isMe) {
        this.scene = scene;
        this.name = data.name;
        this.maxHp = data.hp || 100;
        this.hp = this.maxHp;
        this.maxMp = data.mp || 0; 
        this.mp = 0; 
        
        this.arrows = 0; 
        this.movedDistance = 0; 

        this.x = x; this.y = y;
        this.isMe = isMe;

        this.skills = data.skills.map(key => ({...DB.SKILLS[key], id: key}));
        this.passive = data.passive ? DB.PASSIVES[data.passive] : null;
        this.moveRange = data.move;
        this.currentMove = 0;
        
        this.cooldowns = {};
        this.shieldThrown = false; 
        this.guardActive = false; 
        this.ultUsed = false;
        this.passiveDisabledTurns = 0; 
        this.passiveTriggeredCount = 0; 
        this.stealthActive = false;
        this.isStealthReaction = false; 
        this.aimActive = false; 
        this.isAimingReaction = false; 
        this.chargingSkill = null; 

        this.ambushBuff = false; 
        this.daggerBuff = false; 
        this.pathSetBuff = 0; 
        this.hitsToEnemy = 0;
        this.hasAmbushedOnce = false; 

        const worldPos = gridToWorld(x, y);
        let spriteKey = 'knight_art';
        if (this.name === "마법사") spriteKey = 'mage_art';
        if (this.name === "닌자") spriteKey = 'ninja_art';
        if (this.name === "보우 마스터") spriteKey = 'archer_art';
        if (this.name === "패스파인더") spriteKey = 'pathfinder_art';
        
        this.sprite = scene.add.sprite(worldPos.x, worldPos.y, spriteKey).setScale(1.5);
        if (!isMe) this.sprite.setTint(0xff5555);

        this.hpBar = scene.add.graphics();
        this.textInfo = scene.add.text(worldPos.x, worldPos.y - 60, "", { fontSize: '12px', fill: '#fff' }).setOrigin(0.5);
        this.updateBars();
    }

    updateBars() {
        this.hpBar.clear();
        const x = this.sprite.x - 25;
        const y = this.sprite.y - 45;
        const width = 50;
        this.hpBar.fillStyle(0x000000); this.hpBar.fillRect(x, y, width, 6);
        const hpPct = this.hp / this.maxHp;
        this.hpBar.fillStyle(hpPct > 0.5 ? 0x00ff00 : 0xff0000);
        this.hpBar.fillRect(x, y, width * Math.max(0, hpPct), 6);
        if (this.maxMp > 0) {
            this.hpBar.fillStyle(0x000000); this.hpBar.fillRect(x, y + 7, width, 4);
            const mpPct = this.mp / this.maxMp;
            this.hpBar.fillStyle(0x00bfff);
            this.hpBar.fillRect(x, y + 7, width * Math.max(0, mpPct), 4);
        }
        
        if (this.name === "패스파인더") {
            this.textInfo.setText(`🏹 ${this.arrows}`);
            this.textInfo.x = this.sprite.x; this.textInfo.y = this.sprite.y - 60;
        }
    }

    visualMoveTo(gx, gy, callback) {
        const dist = Math.abs(this.x - gx) + Math.abs(this.y - gy);
        this.movedDistance += dist;

        if (this.name === "패스파인더" && this.passive) {
            const earnedArrows = Math.floor(this.movedDistance / 4) - Math.floor((this.movedDistance - dist) / 4);
            if (earnedArrows > 0) {
                this.arrows += earnedArrows;
                showFloatingText(this.scene, this.sprite.x, this.sprite.y, `화살 +${earnedArrows}`, 0xffaa00);
            }
        }

        const worldPos = gridToWorld(gx, gy);
        this.scene.tweens.add({
            targets: [this.sprite, this.textInfo],
            x: worldPos.x, y: worldPos.y, duration: 300,
            onUpdate: () => this.updateBars(),
            onComplete: () => { this.updateBars(); if (callback) callback(); }
        });
    }

    onTurnStart() {
        for (let k in this.cooldowns) if(this.cooldowns[k] > 0) this.cooldowns[k]--;
        this.passiveTriggeredCount = 0;
        this.isStealthReaction = false; 
        this.isAimingReaction = false;
        
        this.movedDistance = 0; 
        this.ambushBuff = false;
        this.daggerBuff = false;
        if (this.pathSetBuff > 0) this.pathSetBuff--;

        if (this.passiveDisabledTurns > 0) {
            this.passiveDisabledTurns--;
        } 
        else if (this.passive && this.passive.type === 'regen') {
            const oldMp = this.mp;
            this.mp = Math.min(this.maxMp, this.mp + this.passive.amount);
            if (this.mp > oldMp) showFloatingText(this.scene, this.sprite.x, this.sprite.y - 60, `MP +${this.mp - oldMp}`, 0x00bfff);
        }
        this.updateBars();
    }

    takeDamage(amount) {
        let finalDamage = amount;
        let text = `-${amount}`;
        let color = 0xff0000;

        if (this.guardActive) {
            finalDamage = Math.floor(finalDamage * 0.7);
            this.guardActive = false; text = `Guard! -${finalDamage}`; color = 0x0000ff;
        } 
        else if (this.passive && this.passive.type === 'defense' && !this.shieldThrown) {
            if (this.passiveTriggeredCount < this.passive.maxCount && Math.random() < this.passive.rate) {
                finalDamage = Math.floor(finalDamage * (1 - this.passive.reduction));
                this.passiveTriggeredCount++; text = `Block! -${finalDamage}`; color = 0xffff00;
            }
        }
        
        this.hp -= finalDamage;
        if (this.hp < 0) this.hp = 0;
        this.updateBars();
        showFloatingText(this.scene, this.sprite.x, this.sprite.y - 50, text, color);
        return this.hp <= 0;
    }
}

// === 에셋 생성 ===
function preload() {
    const createPixelArt = (key, w, h, pal, px) => {
        const t = this.textures.createCanvas(key, w, h);
        const ctx = t.context;
        const pw = w/px[0].length, ph = h/px.length;
        for(let y=0; y<px.length; y++) for(let x=0; x<px[y].length; x++) {
            if(px[y][x]!==' ') { ctx.fillStyle=pal[px[y][x]]; ctx.fillRect(x*pw, y*ph, pw, ph); }
        }
        t.refresh();
    };
    createPixelArt('knight_art', 32, 32, {'s':'#C0C0C0','f':'#FFCC99','r':'#FF0000','b':'#4169E1','g':'#404040'}, ["   ssss   ","  ssrrss  ","  ssssss  ","   ffff   ","  ssbbss  "," ggssssgg "," g ssss g ","   ssss   ","   s  s   "]);
    createPixelArt('mage_art', 32, 32, {'p':'#800080','f':'#FFCC99','y':'#FFD700'}, ["   pppp   ","  pppppp  ","   ffff   ","  pppppp  "," yppppppy "," y pppp y ","   pppp   ","   p  p   "]);
    createPixelArt('ninja_art', 32, 32, {'b':'#1a1a1a', 'g':'#4a4a4a', 'r':'#8b0000'}, ["   bbbb   ","  bbbbbb  ","  bsbbsb  ","  bbbbbb  ","   bbbb   ","  gbbbbg  ","  g rr g  ","   b  b   ","   b  b   "]);
    createPixelArt('archer_art', 32, 32, {'g':'#228B22', 'b':'#8B4513', 'f':'#FFCC99'}, ["   gggg   ","  ggggbb  ","   ffff   ","  gggggg  "," bggggggb "," b gggg b ","   gggg   ","   b  b   ","   b  b   "]);
    createPixelArt('pathfinder_art', 32, 32, {'o':'#FF4500', 'b':'#8B4513', 'w':'#FFFFFF'}, ["   oooo   ","  oooooo  ","   wwww   ","  bbbbbb  "," obbbbbbo "," o bbbb o ","   bbbb   ","   b  b   ","   b  b   "]);

    const c = (k, c) => { const t=this.textures.createCanvas(k,32,32); t.context.fillStyle=c; t.context.fillRect(0,0,32,32); t.refresh(); };
    c('tile_grass','#4CAF50'); c('tile_water','#2196F3'); c('tile_sand','#F0E68C'); c('tile_mount','#757575');
}

function create() {
    const mapGen = new MapGenerator(mapWidth, mapHeight);
    mapData = mapGen.generate();
    
    const startX = (800 - (mapWidth * gridSize)) / 2; 
    const startY = (600 - (mapHeight * gridSize)) / 2;
    for (let x = 0; x < mapWidth; x++) {
        visualGrid[x] = [];
        for (let y = 0; y < mapHeight; y++) {
            const tileInfo = mapData[x][y];
            let key = 'tile_grass';
            if (tileInfo.finalType.name === 'Water') key = 'tile_water';
            else if (tileInfo.finalType.name === 'Sand') key = 'tile_sand';
            else if (tileInfo.finalType.name === 'Mountain') key = 'tile_mount';
            const sprite = this.add.image(startX + x*gridSize+gridSize/2, startY + y*gridSize+gridSize/2, key).setDisplaySize(gridSize, gridSize).setInteractive();
            visualGrid[x][y] = sprite;
            sprite.on('pointerdown', () => onTileClick(x, y));
        }
    }

    const myCharKey = (myRole === 'host') ? window.selectedChars.host : window.selectedChars.guest;
    const enemyCharKey = (myRole === 'host') ? window.selectedChars.guest : window.selectedChars.host;
    const myPos = (myRole === 'host') ? {x:3, y:8} : {x:3, y:1};
    const enemyPos = (myRole === 'host') ? {x:3, y:1} : {x:3, y:8};

    playerUnit = new Unit(this, DB.CHARACTERS[myCharKey], myPos.x, myPos.y, true);
    enemyUnit = new Unit(this, DB.CHARACTERS[enemyCharKey], enemyPos.x, enemyPos.y, false);

    statusText = this.add.text(10, 10, '게임 시작 대기 중...', { font: '20px Arial', fill: '#fff' });
    createActionMenu(this);
    setupDBListeners();
}

function update() {}

function setupDBListeners() {
    const roomRef = window.dbRef(window.db, 'rooms/' + currentRoomId);
    window.dbOnValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        if (data.turn === myRole) {
            if (!isMyTurn) {
                turnCount = data.turnCount || 1; 
                startPlayerTurn(); 
            }
        } else {
            if (isMyTurn) {
                isMyTurn = false; gameState = STATE.ENEMY_TURN;
                statusText.setText("상대방의 턴입니다...");
                clearHighlights(); closeActionMenu();
            }
        }

        const enemyDataKey = (myRole === 'host') ? 'guestUnit' : 'hostUnit';
        const myDataKey = (myRole === 'host') ? 'hostUnit' : 'guestUnit';
        const enemyDB = data[enemyDataKey];
        const myDB = data[myDataKey];

        if (enemyDB) {
            if (enemyUnit.x !== enemyDB.x || enemyUnit.y !== enemyDB.y) {
                enemyUnit.x = enemyDB.x; enemyUnit.y = enemyDB.y;
                enemyUnit.visualMoveTo(enemyDB.x, enemyDB.y);
            }
            enemyUnit.hp = enemyDB.hp; 
            if (enemyDB.mp !== undefined) enemyUnit.mp = enemyDB.mp;
            if (enemyDB.stealthActive) enemyUnit.sprite.setAlpha(0);
            else enemyUnit.sprite.setAlpha(1);
            if (enemyDB.hasAmbushedOnce) enemyUnit.hasAmbushedOnce = true; 
            enemyUnit.updateBars();
        }
        if (myDB) {
            if (playerUnit.hp !== myDB.hp) {
                playerUnit.hp = myDB.hp; playerUnit.updateBars();
                showFloatingText(game.scene.scenes[0], playerUnit.sprite.x, playerUnit.sprite.y - 50, "HIT!", 0xff0000);
            }
        }
    });
}

function startPlayerTurn() {
    isMyTurn = true;
    gameState = STATE.IDLE;
    playerUnit.onTurnStart();

    if (playerUnit.chargingSkill) {
        playerUnit.chargingSkill.turnsLeft--;
        statusText.setText(`차징 중... (${playerUnit.chargingSkill.turnsLeft}턴 남음)`);
        if (playerUnit.chargingSkill.turnsLeft <= 0) {
            const target = enemyUnit;
            let damage = 70;
            let isCrit = false;
            if (playerUnit.passive && playerUnit.passive.name === "크리티컬" && Math.random() < (playerUnit.passive.rate + 0.1)) {
                damage = Math.floor(damage * playerUnit.passive.multiplier); isCrit = true;
            }
            target.hp -= damage; if(target.hp<0) target.hp=0;
            showFloatingText(game.scene.scenes[0], target.sprite.x, target.sprite.y - 50, isCrit ? `HEADSHOT! -${damage}` : `SHOT! -${damage}`, 0xff0000);
            playerUnit.chargingSkill = null; 
            setTimeout(() => { updateDB(true); }, 1500); 
        } else {
             setTimeout(() => { updateDB(true); }, 1000); 
        }
        return; 
    }

    let moveBonus = 0;
    if (playerUnit.stealthActive && playerUnit.passive && playerUnit.passive.type === 'state') moveBonus = 1;
    if (playerUnit.pathSetBuff > 0) moveBonus += 7; 

    playerUnit.currentMove = Phaser.Math.Between(...playerUnit.moveRange);
    playerUnit.currentMove += moveBonus;

    if (playerUnit.isAimingReaction) playerUnit.currentMove = 0;

    statusText.setText(`[나의 턴] 이동: ${playerUnit.currentMove} | MP: ${playerUnit.mp}`);
    
    if (playerUnit.stealthActive) playerUnit.sprite.setAlpha(0.5);
    else playerUnit.sprite.setAlpha(1);

    updateActionMenu();
}

function onTileClick(x, y) {
    if (!isMyTurn || gameState === STATE.BUSY) return;

    if (gameState === STATE.IDLE) {
        if (x === playerUnit.x && y === playerUnit.y) {
            gameState = STATE.MOVE; showRange(x, y, playerUnit.currentMove, 0x0000ff);
        }
    } 
    else if (gameState === STATE.MOVE) {
        if (isHighlighted(x, y)) {
            tempX = x; tempY = y; clearHighlights();
            playerUnit.visualMoveTo(x, y);
            gameState = STATE.ACTION; updateActionMenu(); openActionMenu();
        } else cancelMove();
    }
    else if (gameState === STATE.TARGET) {
        if (selectedSkill.type === 'buff' && x === tempX && y === tempY) { executeAction(selectedSkill, null); }
        else if (isHighlighted(x, y) && x === enemyUnit.x && y === enemyUnit.y) {
            if (selectedSkill.id === 'PATH_SET') {
                gameState = STATE.ENEMY_MOVE_SELECT;
                statusText.setText("상대를 이동시킬 위치 선택");
                clearHighlights(); 
                const enemyMaxMove = enemyUnit.moveRange[1];
                showRange(enemyUnit.x, enemyUnit.y, enemyMaxMove, 0xffff00); 
                return;
            }
            executeAction(selectedSkill, enemyUnit); 
        }
        else cancelAction();
    }
    else if (gameState === STATE.ENEMY_MOVE_SELECT) {
        if (isHighlighted(x, y)) {
            executeAction(selectedSkill, enemyUnit, { destX: x, destY: y });
        } else {
            cancelAction();
        }
    }
}

function executeAction(skill, target, extraData) {
    gameState = STATE.BUSY; closeActionMenu(); clearHighlights();
    
    if (skill.cost > 0) playerUnit.mp -= skill.cost;
    if (skill.disablePassive) playerUnit.passiveDisabledTurns = skill.disablePassive;

    if (skill.effect === 'detect' && target) {
        const dist = Math.abs(playerUnit.x - target.x) + Math.abs(playerUnit.y - target.y);
        let msg = "";
        if (dist % 3 === 0) { playerUnit.ambushBuff = true; msg += "기습 강화! "; }
        if (dist % 2 === 0) { playerUnit.daggerBuff = true; msg += "단검 강화!"; } 
        if (!msg) msg = "효과 없음 (거리 안맞음)";
        showFloatingText(game.scene.scenes[0], playerUnit.sprite.x, playerUnit.sprite.y, msg, 0xffaa00);
    }

    if (skill.effect === 'pathset' && target && extraData) {
        playerUnit.pathSetBuff = 2; 
        target.x = extraData.destX; 
        target.y = extraData.destY;
        target.visualMoveTo(extraData.destX, extraData.destY);
        showFloatingText(game.scene.scenes[0], target.sprite.x, target.sprite.y, "강제 이동!", 0xff0000);
    }

    if (skill.chargeTurn) {
        playerUnit.chargingSkill = { id: skill.id, turnsLeft: skill.chargeTurn };
        showFloatingText(game.scene.scenes[0], playerUnit.sprite.x, playerUnit.sprite.y, "차징 시작...", 0xffaa00);
        setTimeout(() => { updateDB(true); }, 1000); 
        return;
    }

    if (skill.effect === 'aim') playerUnit.aimActive = true;
    
    if (skill.effect === 'backstep') {
        let dx = playerUnit.x - enemyUnit.x; let dy = playerUnit.y - enemyUnit.y;
        if (dx === 0 && dy === 0) dx = 1; 
        let nx = Math.max(0, Math.min(mapWidth-1, playerUnit.x + Math.sign(dx)*2));
        let ny = Math.max(0, Math.min(mapHeight-1, playerUnit.y + Math.sign(dy)*2));
        tempX = nx; tempY = ny;
    }
    else if (skill.teleportBehind && target) {
        const neighbors = [{x:target.x,y:target.y-1},{x:target.x,y:target.y+1},{x:target.x-1,y:target.y},{x:target.x+1,y:target.y}];
        const valid = neighbors.find(p=>p.x>=0 && p.x<mapWidth && p.y>=0 && p.y<mapHeight && !(p.x===playerUnit.x && p.y===playerUnit.y) && !(p.x===target.x && p.y===target.y));
        if (valid) { tempX = valid.x; tempY = valid.y; }
    }

    playerUnit.x = tempX; playerUnit.y = tempY; 

    if (skill.effect === 'stealth') { playerUnit.stealthActive = true; playerUnit.sprite.setAlpha(0.5); }
    if (skill.reqStealth) { playerUnit.stealthActive = false; playerUnit.sprite.setAlpha(1); }

    if (skill.type === 'buff' && skill.name === "가드") playerUnit.guardActive = true;
    if (skill.isUltimate && playerUnit.name === "기사") { playerUnit.shieldThrown = true; playerUnit.ultUsed = true; }

    if (skill.power > 0 && target) {
        let dmg = skill.power;
        
        if (playerUnit.name === "패스파인더") {
            if (skill.name === "단검 찌르기" && playerUnit.daggerBuff) { dmg += 10; playerUnit.daggerBuff = false; }
            if (skill.name === "석궁 쇄도") { dmg = playerUnit.arrows * 10; playerUnit.arrows = 0; }
            
            if (playerUnit.movedDistance >= 8) {
                let multiplier = playerUnit.ambushBuff ? 3 : 2;
                dmg *= multiplier;
                playerUnit.ambushBuff = false;
                playerUnit.hasAmbushedOnce = true; 
                showFloatingText(game.scene.scenes[0], playerUnit.sprite.x, playerUnit.sprite.y - 70, `기습! x${multiplier}`, 0xff0000);
            }
            
            if (skill.id === 'PATH_SET') {}
            else {
                playerUnit.hitsToEnemy++;
                if (playerUnit.hitsToEnemy % 2 === 0) {
                     if (playerUnit.cooldowns['PATH_SET'] > 0) playerUnit.cooldowns['PATH_SET']--;
                     showFloatingText(game.scene.scenes[0], playerUnit.sprite.x, playerUnit.sprite.y - 80, "쿨타임 감소!", 0x00ff00);
                }
            }
        }

        if (playerUnit.aimActive && skill.name === "저격") { dmg += 20; playerUnit.aimActive = false; }
        if (playerUnit.passive && playerUnit.passive.type === 'attack' && Math.random() < playerUnit.passive.rate) dmg = Math.floor(dmg * playerUnit.passive.multiplier);

        if (target.guardActive) dmg = Math.floor(dmg * 0.7);
        target.hp -= dmg; if(target.hp < 0) target.hp = 0;
    }

    if (skill.triggerReAction) {
        setTimeout(() => {
            playerUnit.currentMove = 3; gameState = STATE.IDLE;
            statusText.setText("재행동 발동!");
            if(skill.effect === 'stealth') playerUnit.isStealthReaction = true; 
            if(skill.effect === 'aim') playerUnit.isAimingReaction = true; 
            if(skill.effect === 'backstep') playerUnit.currentMove = 0; 
            updateDB(false); 
        }, 800);
    } 
    else if (skill.extraMove) {
         setTimeout(() => {
            playerUnit.currentMove = skill.extraMove; gameState = STATE.IDLE;
            statusText.setText(`추가 이동!`);
            updateDB(false);
         }, 800);
    }
    else {
        playerUnit.isStealthReaction = false;
        setTimeout(() => { updateDB(true); }, 500); 
    }
}

function updateDB(endTurn) {
    const updates = {};
    const myKey = (myRole === 'host') ? 'hostUnit' : 'guestUnit';
    const enemyKey = (myRole === 'host') ? 'guestUnit' : 'hostUnit';
    
    updates[`rooms/${currentRoomId}/${myKey}/x`] = playerUnit.x;
    updates[`rooms/${currentRoomId}/${myKey}/y`] = playerUnit.y;
    updates[`rooms/${currentRoomId}/${myKey}/hp`] = playerUnit.hp;
    updates[`rooms/${currentRoomId}/${myKey}/mp`] = playerUnit.mp;
    updates[`rooms/${currentRoomId}/${myKey}/stealthActive`] = playerUnit.stealthActive;
    if(playerUnit.name === "패스파인더") {
        updates[`rooms/${currentRoomId}/${myKey}/arrows`] = playerUnit.arrows;
        updates[`rooms/${currentRoomId}/${myKey}/hasAmbushedOnce`] = playerUnit.hasAmbushedOnce;
    }

    updates[`rooms/${currentRoomId}/${enemyKey}/hp`] = enemyUnit.hp;
    updates[`rooms/${currentRoomId}/${enemyKey}/x`] = enemyUnit.x; 
    updates[`rooms/${currentRoomId}/${enemyKey}/y`] = enemyUnit.y;

    if (endTurn) {
        updates[`rooms/${currentRoomId}/turn`] = (myRole === 'host') ? 'guest' : 'host';
        updates[`rooms/${currentRoomId}/turnCount`] = turnCount + 1; 
    }
    window.dbUpdate(window.dbRef(window.db), updates);
}

// === 유틸리티 ===
function cancelMove() { gameState = STATE.IDLE; clearHighlights(); closeActionMenu(); playerUnit.visualMoveTo(playerUnit.x, playerUnit.y); }
function cancelAction() { gameState = STATE.ACTION; clearHighlights(); openActionMenu(); }
function gridToWorld(x, y) { return { x: (800 - (mapWidth*gridSize))/2 + x*gridSize + gridSize/2, y: (600 - (mapHeight*gridSize))/2 + y*gridSize + gridSize/2 }; }

function showRange(sx, sy, range, color) {
    moveHighlights = []; const scene = game.scene.scenes[0];
    let minRange = (selectedSkill && selectedSkill.minRange) ? selectedSkill.minRange : 0;
    
    if (selectedSkill && selectedSkill.minDist) {
        const distToEnemy = Math.abs(playerUnit.x - enemyUnit.x) + Math.abs(playerUnit.y - enemyUnit.y);
        if (distToEnemy < selectedSkill.minDist) {
            statusText.setText(`거리 부족! (${selectedSkill.minDist} 이상 필요)`);
            return; 
        }
    }

    for(let x=0; x<mapWidth; x++) for(let y=0; y<mapHeight; y++) {
        const dist = Math.abs(sx-x) + Math.abs(sy-y);
        if (dist >= minRange && dist <= range && mapData[x][y].finalType.name !== 'Water') {
            if (color === 0x0000ff && x === enemyUnit.x && y === enemyUnit.y) continue; 
            const pos = gridToWorld(x, y);
            
            // [수정] 네모 박스에 클릭 이벤트를 추가했습니다!
            const rect = scene.add.rectangle(pos.x, pos.y, gridSize, gridSize, color, 0.4).setInteractive();
            rect.on('pointerdown', () => onTileClick(x, y)); 
            
            moveHighlights.push({x,y,rect});
        }
    }
}

function clearHighlights() { moveHighlights.forEach(h => h.rect.destroy()); moveHighlights = []; }
function isHighlighted(x, y) { return moveHighlights.some(h => h.x === x && h.y === y); }
function showFloatingText(s,x,y,m,c) { const t=s.add.text(x,y,m,{fontSize:'24px',fill:'#fff',stroke:'#000',strokeThickness:4}).setOrigin(0.5); if(c)t.setTint(c); s.tweens.add({targets:t,y:y-40,alpha:0,duration:1000,onComplete:()=>t.destroy()}); }
function createActionMenu(s) { actionMenuGroup = s.add.group(); }
function openActionMenu() { actionMenuGroup.getChildren().forEach(c => c.setVisible(true)); }
function closeActionMenu() { actionMenuGroup.getChildren().forEach(c => c.setVisible(false)); }
function updateActionMenu() {
    actionMenuGroup.clear(true, true);
    let btnY = 300; const scene = game.scene.scenes[0];
    playerUnit.skills.forEach(skill => {
        let cd = playerUnit.cooldowns[skill.id] || 0;
        let cost = skill.cost || 0;
        let disabled = (cd > 0) || (playerUnit.mp < cost) || (skill.isUltimate && playerUnit.ultUsed) || (skill.id==='GUARD' && playerUnit.shieldThrown);
        
        if (playerUnit.name === "닌자" && playerUnit.isStealthReaction) {
            if (skill.name === "은신" || skill.isUltimate) disabled = true;
        }
        if (skill.reqStealth && !playerUnit.stealthActive) disabled = true;
        if (playerUnit.isAimingReaction && skill.name !== "저격") disabled = true;
        
        if (skill.reqAmbush && !playerUnit.hasAmbushedOnce) disabled = true;

        let color = disabled ? 0x333333 : 0x880000;
        let label = skill.name + (cd>0?`(${cd})`: cost>0?`[${cost}]`:"");
        
        const btn = scene.add.rectangle(700, btnY, 180, 35, color).setInteractive();
        const txt = scene.add.text(700, btnY, label, { fontSize: '14px' }).setOrigin(0.5);
        if(!disabled) {
            btn.on('pointerdown', () => {
                selectedSkill = skill; closeActionMenu(); gameState = STATE.TARGET;
                if(skill.type==='buff') { statusText.setText("자신 선택"); showRange(tempX, tempY, 0, 0x00ff00); }
                else { statusText.setText("적 선택"); showRange(tempX, tempY, skill.range, 0xff0000); }
            });
        }
        actionMenuGroup.addMultiple([btn, txt]); btnY += 45;
    });
    const wb = scene.add.rectangle(700, btnY, 180, 35, 0x008800).setInteractive();
    const wt = scene.add.text(700, btnY, "대기", {fontSize:'14px'}).setOrigin(0.5);
    wb.on('pointerdown', () => { gameState = STATE.BUSY; closeActionMenu(); playerUnit.x=tempX; playerUnit.y=tempY; updateDB(true); });
    actionMenuGroup.addMultiple([wb, wt]);
}