// ==========================================
// [Part 0] 맵 생성 및 설정
// ==========================================
if (typeof window.MapGenerator === 'undefined') {
    window.MapGenerator = class MapGenerator {
        constructor(width, height) { this.width = width; this.height = height; }
        generate() {
            let map = [];
            for (let x = 0; x < this.width; x++) {
                map[x] = [];
                for (let y = 0; y < this.height; y++) {
                    let type = 'Grass';
                    const isSafeZone = (x === 5);
                    const rand = Math.random();
                    if (!isSafeZone) {
                        if (rand < 0.1) type = 'Water';    
                        else if (rand < 0.2) type = 'Mountain'; 
                        else if (rand < 0.3) type = 'Sand';     
                    }
                    map[x][y] = { type: type };
                }
            }
            return map;
        }
    };
}

// ==========================================
// [Part 1] 데이터베이스 (캐릭터 상세 설명 추가)
// ==========================================
const DB = {
    SKILLS: {
        SLASH: { name: "베기", power: 25, range: 3, cooldown: 0, cost: 0, desc: "사거리 3칸, 데미지 25" },
        UPPER_SLASH: { name: "상단 베기", power: 50, range: 2, cooldown: 3, cost: 0, desc: "강력한 일격 (쿨타임 3)" },
        GUARD: { name: "가드", type: "buff", cooldown: 2, reduction: 0.3, cost: 0, desc: "다음 피해 30% 경감" },
        SHIELD_THROW: { name: "방패 던지기", power: 10, range: 4, triggerReAction: true, isUltimate: true, cost: 0, desc: "[궁극기] 사용 후 재행동 (1회용)" },
        
        MAGIC_MISSILE: { name: "매직미사일", power: 20, range: 5, cost: 10, cooldown: 0, desc: "MP 10 소모, 사거리 5" },
        FIREBALL: { name: "파이어볼", power: 30, range: 5, cost: 20, cooldown: 2, desc: "화염구 (MP 20, 쿨 2)" },
        ICE_SPEAR: { name: "아이스 스피어", power: 35, range: 4, cost: 20, cooldown: 2, desc: "얼음창 (MP 20, 쿨 2)" },
        INFERNITY: { name: "인페르니티", power: 110, range: 8, cost: 100, cooldown: 5, isUltimate: true, disablePassive: 1, desc: "[궁극기] MP 100, 패시브 봉인" },

        DIAGONAL_SLASH: { name: "사선베기", power: 25, range: 2, cooldown: 0, cost: 0, extraMove: 3, desc: "공격 후 3칸 추가이동" },
        STEALTH: { name: "은신", type: "buff", range: 0, cooldown: 4, cost: 0, triggerReAction: true, effect: "stealth", desc: "은신(이동+1) & 재행동" },
        KUNAI_THROW: { name: "쿠나이 던지기", power: 25, range: 4, cooldown: 0, cost: 0, extraMove: 3, desc: "원거리 견제 & 이동" },
        BACKSTAB: { name: "배후노리기", power: 60, range: 6, cooldown: 0, cost: 0, isUltimate: true, reqStealth: true, teleportBehind: true, extraMove: 1, desc: "[궁극기] 은신 필수. 적 뒤로 이동" },

        SNIPE: { name: "저격", power: 20, range: 6, minRange: 4, cooldown: 0, cost: 0, desc: "사거리 4-6. 조준 시 강화" },
        AIM: { name: "조준", type: "buff", range: 0, cooldown: 0, cost: 0, triggerReAction: true, effect: "aim", desc: "이동불가, 저격 강화, 재행동" },
        BACKSTEP: { name: "백스텝", power: 0, range: 0, cooldown: 2, cost: 0, triggerReAction: true, effect: "backstep", desc: "뒤로 2칸 이동 & 재행동" },
        HEADSHOT: { name: "헤드샷", power: 70, range: 7, minRange: 5, cooldown: 6, cost: 0, isUltimate: true, chargeTurn: 1, desc: "[궁극기] 1턴 차징 후 발사" },

        DAGGER_STAB: { name: "단검 찌르기", power: 20, range: 2, cooldown: 0, cost: 0, desc: "기본 공격" },
        PATH_DETECT: { name: "경로 탐지", type: "buff", range: 0, cooldown: 2, cost: 0, effect: "path_detect", desc: "3의배수:기습3배 / 2의배수:단검+10" },
        PATH_SET: { name: "경로 설정", type: "buff", range: 0, cooldown: 4, cost: 0, triggerReAction: true, effect: "path_set", desc: "거리10이상 시 이동+7 & 재행동" },
        CROSSBOW_SURGE: { name: "석궁 쇄도", power: 0, range: 5, cooldown: 4, cost: 0, isUltimate: true, desc: "[궁극기] 기습(11칸) 발동 시 사용가능" }
    },
    PASSIVES: {
        KNIGHT_SHIELD: { name: "기사의 방패", desc: "30%확률로 데미지 20% 경감" },
        MANA_MASTER: { name: "마나의 주인", desc: "매 턴 MP 30 회복" },
        STEALTH_ART: { name: "은신술", desc: "은신 시 이동력 +1" },
        CRITICAL_HIT: { name: "크리티컬 히트", desc: "5% 확률로 1.5배 데미지" },
        PATHFINDER_KIT: { name: "패스파인더 키트", desc: "기습(11칸이상 2배), 화살줍기(4칸당+1)" }
    },
    CHARACTERS: {
        KNIGHT: { name: "기사", hp: 120, mp: 0, move: [3, 4], skills: ["SLASH", "UPPER_SLASH", "GUARD", "SHIELD_THROW"], passive: "KNIGHT_SHIELD", color: '#C0C0C0', desc: "높은 체력과 방어력\n아군을 지키는 든든한 탱커" },
        MAGE: { name: "마법사", hp: 100, mp: 100, move: [2, 4], skills: ["MAGIC_MISSILE", "FIREBALL", "ICE_SPEAR", "INFERNITY"], passive: "MANA_MASTER", color: '#9C27B0', desc: "강력한 마법 공격\nMP 관리가 중요한 누커" },
        NINJA: { name: "닌자", hp: 85, mp: 0, move: [4, 5], skills: ["DIAGONAL_SLASH", "STEALTH", "KUNAI_THROW", "BACKSTAB"], passive: "STEALTH_ART", color: '#333333', desc: "은신과 기동성\n적의 배후를 노리는 암살자" },
        BOW_MASTER: { name: "보우 마스터", hp: 100, mp: 0, move: [3, 4], skills: ["SNIPE", "AIM", "BACKSTEP", "HEADSHOT"], passive: "CRITICAL_HIT", color: '#228B22', desc: "초장거리 저격수\n자리 잡기와 조준이 핵심" },
        PATHFINDER: { name: "패스파인더", hp: 70, mp: 0, move: [4, 7], skills: ["DAGGER_STAB", "PATH_DETECT", "PATH_SET", "CROSSBOW_SURGE"], passive: "PATHFINDER_KIT", color: '#FF4500', desc: "이동 거리에 비례한 데미지\n전장을 누비는 기동형 사수" }
    }
};

const PIXEL_DATA = {
    knight: { colors: {'s':'#C0C0C0','f':'#FFCC99','r':'#FF0000','b':'#4169E1'}, data: ["  ssss  "," ssrrss "," ssssss ","  ffff  ","  bbbb  "," ggssgg ","  s  s  "] },
    mage: { colors: {'p':'#800080','f':'#FFCC99','y':'#FFD700'}, data: ["  pppp  "," pppppp ","  ffff  ","  pppp  "," yppppppy","  p  p  "] },
    ninja: { colors: {'k':'#1a1a1a','r':'#8b0000','s':'#fff'}, data: ["  kkkk  "," kkkkkk "," kskksk ","  ffff  ","  kkkk  "," krrkkr ","  k  k  "] },
    bowmaster: { colors: {'g':'#2E7D32','b':'#8B4513','f':'#FFCC99'}, data: ["  gggg  "," ggggb b","  ffff  ","  gggg  "," bgggggb","  g  g  "] },
    pathfinder: { colors: {'o':'#FF4500','b':'#444','f':'#FFCC99'}, data: ["  oooo  "," oooooo ","  ffff  ","  bbbb  "," obbbbo ","  b  b  "] }
};

// ==========================================
// [Part 2] 전역 변수
// ==========================================
let myRole = null; let currentRoomId = null; let isMyTurn = false;
let selectedCharKey = null; let game = null;

const mapWidth = 11, mapHeight = 7, gridSize = 60;
let mapData = [], visualGrid = [];
let playerUnit, enemyUnit, gameState = 0;
let statusText, actionMenuGroup, skillDescText, hudGroup; // UI 요소들
let reservedX, reservedY, selectedSkill, moveHighlights = [];
const STATE = { IDLE: 0, MOVE_SELECT: 1, ACTION_WAIT: 2, TARGET_SELECT: 3, BUSY: 4 };

// 좌표 변환
function toLocal(x, y) { return myRole === 'p2' ? { x: (mapWidth - 1) - x, y: (mapHeight - 1) - y } : { x: x, y: y }; }
function toServer(x, y) { return myRole === 'p2' ? { x: (mapWidth - 1) - x, y: (mapHeight - 1) - y } : { x: x, y: y }; }
function gridToWorld(localX, localY) {
    const sX = (800 - (mapWidth * gridSize)) / 2;
    const sY = (600 - (mapHeight * gridSize)) / 2 + 30; // 상단 HUD 공간 확보를 위해 +30
    return { x: sX + localX * gridSize + 30, y: sY + localY * gridSize + 30 };
}

// ==========================================
// [Part 3] UI 및 매칭 (설명창 강화)
// ==========================================
const lobbyScreen = document.getElementById('lobby-screen');
const charSelectScreen = document.getElementById('char-select-screen');
const infoBox = document.getElementById('char-info-box');

function drawIcon(pixels, colors) {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const size = 32 / pixels.length;
    for(let y=0; y<pixels.length; y++) for(let x=0; x<pixels[y].length; x++) {
        if(pixels[y][x] !== ' ') { ctx.fillStyle = colors[pixels[y][x]]; ctx.fillRect(x*size, y*size, size, size); }
    }
    return canvas.toDataURL();
}

document.getElementById('find-match-btn').onclick = () => {
    if (!window.db) { alert("Firebase 설정 오류!"); return; }
    document.getElementById('find-match-btn').disabled = true;
    const roomsRef = window.dbRef(window.db, 'rooms');
    window.dbGet(roomsRef).then((snap) => {
        const rooms = snap.val(); let found = null;
        if (rooms) for (let id in rooms) if (rooms[id].status === 'waiting') { found = id; break; }
        if (found) joinRoom(found); else createRoom();
    });
};

function createRoom() {
    const ref = window.dbPush(window.dbRef(window.db, 'rooms'));
    currentRoomId = ref.key; myRole = 'p1';
    const mapGen = new MapGenerator(mapWidth, mapHeight);
    window.dbSet(ref, { status: 'waiting', turn: 'p1', map: mapGen.generate(), p1Ready: false, p2Ready: false });
    window.dbOnValue(ref, (s) => { if (s.val()?.status === 'selecting') onMatchFound(); });
}

function joinRoom(id) {
    currentRoomId = id; myRole = 'p2';
    window.dbUpdate(window.dbRef(window.db, `rooms/${id}`), { status: 'selecting' });
    onMatchFound();
}

function onMatchFound() {
    lobbyScreen.style.display = 'none';
    charSelectScreen.style.display = 'flex';
    const grid = document.getElementById('char-grid');
    grid.innerHTML = '';
    
    Object.keys(DB.CHARACTERS).forEach(k => {
        const c = DB.CHARACTERS[k];
        const artKey = k.toLowerCase().replace('master', 'master');
        const iconData = PIXEL_DATA[artKey] || PIXEL_DATA['knight'];
        const iconUrl = drawIcon(iconData.data, iconData.colors);
        const btn = document.createElement('div');
        btn.style.cssText = `width:100px; height:110px; background:${c.color}; border:2px solid #fff; cursor:pointer; color:white; display:flex; flex-direction:column; align-items:center; justify-content:center; margin:5px;`;
        btn.innerHTML = `<img src="${iconUrl}" style="width:50px; height:50px; image-rendering:pixelated; margin-bottom:5px;"><b>${c.name}</b>`;
        
        btn.onmouseenter = () => {
            infoBox.innerText = `[${c.name}]\n${c.desc}\n\n[패시브] ${DB.PASSIVES[c.passive].name}: ${DB.PASSIVES[c.passive].desc}`;
        };
        btn.onmouseleave = () => { infoBox.innerText = "캐릭터에 마우스를 올리면 정보가 표시됩니다."; };

        btn.onclick = () => {
            Array.from(grid.children).forEach(b => b.style.border = "2px solid #fff");
            btn.style.border = "4px solid yellow";
            selectedCharKey = k;
            window.dbUpdate(window.dbRef(window.db, `rooms/${currentRoomId}`), { [`${myRole}Char`]: k });
            document.getElementById('lock-in-btn').disabled = false;
        };
        grid.appendChild(btn);
    });
}

document.getElementById('lock-in-btn').onclick = () => {
    window.dbUpdate(window.dbRef(window.db, `rooms/${currentRoomId}`), { [`${myRole}Ready`]: true });
    document.getElementById('lock-in-btn').disabled = true;
};

setInterval(() => {
    if (!currentRoomId) return;
    window.dbGet(window.dbRef(window.db, `rooms/${currentRoomId}`)).then((snap) => {
        const d = snap.val(); if (!d) return;
        if (d.p1Ready && d.p2Ready && d.status !== 'playing') {
            window.selectedChars = { p1: d.p1Char, p2: d.p2Char };
            mapData = d.map;
            if (myRole === 'p1') window.dbUpdate(window.dbRef(window.db, `rooms/${currentRoomId}`), { status: 'playing' });
            charSelectScreen.style.display = 'none'; 
            document.getElementById('game-container').style.display = 'block';
            if (!game) game = new Phaser.Game(config);
        }
    });
}, 1500);

// ==========================================
// [Part 4] 인게임 로직 (겹침 방지, HUD, UI 개선)
// ==========================================
class Unit {
    constructor(scene, data, localX, localY, isMe) {
        this.scene = scene;
        this.name = data.name; this.maxHp = data.hp; this.hp = data.hp; 
        this.mp = 0; this.maxMp = data.mp || 0;
        this.localX = localX; this.localY = localY; this.isMe = isMe;
        this.prevX = localX; this.prevY = localY;
        
        this.skills = data.skills.map(k => ({...DB.SKILLS[k], id: k}));
        this.passive = data.passive ? DB.PASSIVES[data.passive] : null;
        this.moveRange = data.move; this.cooldowns = {}; this.isReAction = false;
        
        // 특수 변수
        this.shieldThrowUsed = false; this.aimActive = false; 
        this.moveBuffTurns = 0; this.hitCount = 0;
        this.arrows = 0; this.movedDistance = 0; this.pathDetectActive = false;

        const pos = gridToWorld(localX, localY);
        let artKey = data.name === "보우 마스터" ? "bowmaster" : data.name.toLowerCase();
        if(!PIXEL_DATA[artKey]) artKey = "knight";
        
        this.sprite = scene.add.sprite(pos.x, pos.y, artKey + '_art').setScale(1.5).setInteractive();
        if (!isMe) this.sprite.setTint(0xff8888);
        this.hpText = scene.add.text(pos.x, pos.y - 35, `${this.hp}`, { fontSize: '14px', fontStyle: 'bold', fill:'#fff' }).setOrigin(0.5);

        // 캐릭터 클릭 시 정보 표시
        this.sprite.on('pointerdown', () => {
            if (skillDescText) {
                const mpTxt = this.maxMp > 0 ? `MP: ${this.mp}/${this.maxMp}` : "MP: 없음";
                skillDescText.setText(`[${this.name}]\nHP: ${this.hp}/${this.maxHp}\n${mpTxt}\n패시브: ${this.passive?.name || '없음'}`).setVisible(true);
            }
        });
    }
    
    updatePos(lx, ly) {
        const dist = Math.abs(this.localX - lx) + Math.abs(this.localY - ly);
        if (this.isMe) this.movedDistance += dist;
        this.localX = lx; this.localY = ly;
        const pos = gridToWorld(lx, ly);
        this.sprite.x = pos.x; this.sprite.y = pos.y;
        this.hpText.x = pos.x; this.hpText.y = pos.y - 35;
    }
    
    savePos() { this.prevX = this.localX; this.prevY = this.localY; }
    revertPos() { this.updatePos(this.prevX, this.prevY); }
    takeDamage(d) { this.hp -= d; this.hpText.setText(`${this.hp}`); updateHUD(); return this.hp <= 0; }
}

const config = { type: Phaser.AUTO, parent: 'game-container', width: 800, height: 600, backgroundColor: '#1a1a1a', scene: { preload: preload, create: create } };

function preload() {
    const createArt = (key, colors, pixels) => {
        const canvas = this.textures.createCanvas(key, 32, 32);
        const ctx = canvas.context;
        const size = 32 / pixels.length;
        for(let y=0; y<pixels.length; y++) for(let x=0; x<pixels[y].length; x++) {
            if(pixels[y][x] !== ' ') { ctx.fillStyle = colors[pixels[y][x]]; ctx.fillRect(x*size, y*size, size, size); }
        }
        canvas.refresh();
    };
    Object.keys(PIXEL_DATA).forEach(k => createArt(k+'_art', PIXEL_DATA[k].colors, PIXEL_DATA[k].data));
}

function create() {
    const sX = (800 - (mapWidth * gridSize)) / 2; 
    const sY = (600 - (mapHeight * gridSize)) / 2 + 30;
    
    // 맵 그리기
    for (let x = 0; x < mapWidth; x++) {
        visualGrid[x] = [];
        for (let y = 0; y < mapHeight; y++) {
            const serverPos = toServer(x, y);
            const type = mapData[serverPos.x] ? mapData[serverPos.x][serverPos.y].type : 'Grass';
            let color = type === 'Water' ? 0x1a4a7a : type === 'Mountain' ? 0x4a4a4a : type === 'Sand' ? 0x8a7a4a : 0x3d5e3a;
            const tile = this.add.rectangle(sX + x*gridSize + 30, sY + y*gridSize + 30, 56, 56, color).setStrokeStyle(2, 0x000, 0.5).setInteractive();
            visualGrid[x][y] = tile; tile.on('pointerdown', () => onTileClick(x, y));
        }
    }
    
    const myK = myRole === 'p1' ? window.selectedChars.p1 : window.selectedChars.p2;
    const enK = myRole === 'p1' ? window.selectedChars.p2 : window.selectedChars.p1;
    
    const myStartLocal = { x: 5, y: 6 };
    const enStartLocal = { x: 5, y: 0 };
    
    playerUnit = new Unit(this, DB.CHARACTERS[myK], myStartLocal.x, myStartLocal.y, true);
    enemyUnit = new Unit(this, DB.CHARACTERS[enK], enStartLocal.x, enStartLocal.y, false);
    
    createHUD(this); // 상단 스탯창
    createActionMenu(this); // 스킬 메뉴
    
    statusText = this.add.text(10, 50, "게임 시작...", { fontSize: '18px', fill: '#fff' }); // HUD 아래로 위치 이동
    
    // 하단 설명창 (배경 포함)
    const descBg = this.add.rectangle(400, 550, 780, 80, 0x000000, 0.8).setStrokeStyle(1, 0x444444);
    skillDescText = this.add.text(400, 550, "캐릭터를 조작하거나 스킬에 마우스를 올리면 설명이 나옵니다.", { 
        fontSize: '16px', fill: '#ffffff', align: 'center', wordWrap: { width: 750 } 
    }).setOrigin(0.5);

    setupSync();
}

// ★★★ 상단 HUD 생성 함수 ★★★
function createHUD(scene) {
    hudGroup = scene.add.group();
    const bg = scene.add.rectangle(400, 20, 800, 40, 0x222222).setOrigin(0.5);
    hudGroup.add(bg);

    scene.p1StatText = scene.add.text(20, 10, "", { fontSize: '16px', fill: '#00ff00', fontStyle: 'bold' });
    scene.p2StatText = scene.add.text(780, 10, "", { fontSize: '16px', fill: '#ff0000', fontStyle: 'bold' }).setOrigin(1, 0);
    
    hudGroup.add(scene.p1StatText);
    hudGroup.add(scene.p2StatText);
    updateHUD();
}

function updateHUD() {
    if (!playerUnit || !enemyUnit) return;
    const p1Mp = playerUnit.maxMp > 0 ? ` MP:${playerUnit.mp}` : "";
    const p2Mp = enemyUnit.maxMp > 0 ? ` MP:${enemyUnit.mp}` : "";
    
    game.scene.scenes[0].p1StatText.setText(`[나] HP:${playerUnit.hp}/${playerUnit.maxHp}${p1Mp}`);
    game.scene.scenes[0].p2StatText.setText(`[적] HP:${enemyUnit.hp}/${enemyUnit.maxHp}${p2Mp}`);
}

function onTileClick(lx, ly) {
    if (!isMyTurn || gameState === STATE.BUSY) return;
    
    if (gameState === STATE.IDLE && lx === playerUnit.localX && ly === playerUnit.localY) {
        playerUnit.savePos();
        clearHighlights(); showMoveRange(lx, ly, Phaser.Math.Between(playerUnit.moveRange[0], playerUnit.moveRange[1]));
        gameState = STATE.MOVE_SELECT;
        
    } else if (gameState === STATE.MOVE_SELECT && isHighlighted(lx, ly)) {
        reservedX = lx; reservedY = ly; clearHighlights();
        playerUnit.updatePos(reservedX, reservedY);
        gameState = STATE.ACTION_WAIT; openActionMenu();
        
    } else if (gameState === STATE.TARGET_SELECT && isHighlighted(lx, ly)) {
        if (lx === enemyUnit.localX && ly === enemyUnit.localY) executeAction(selectedSkill, enemyUnit);
        else if (selectedSkill.range === 0 && lx === reservedX && ly === reservedY) executeAction(selectedSkill, playerUnit);
    }
}

function executeAction(skill, target) {
    gameState = STATE.BUSY; closeActionMenu(); clearHighlights();
    
    if (skill.cost > 0) playerUnit.mp -= skill.cost;
    
    if (skill.power > 0 && target) {
        let finalDamage = skill.power;
        // ... (데미지 계산 로직 기존과 동일) ...
        if (playerUnit.name === "패스파인더") {
             if (skill.name === "석궁 쇄도") finalDamage = playerUnit.movedDistance >= 11 ? playerUnit.arrows * 10 : 0;
             if (playerUnit.movedDistance >= 11) finalDamage *= 2; 
        }
        
        // 보우마스터 조준 해제
        if (skill.name === "저격" && playerUnit.aimActive) {
            finalDamage += 20; playerUnit.aimActive = false;
        }

        target.takeDamage(finalDamage);
    }
    
    updateHUD(); // 스탯 변경 반영

    if (skill.triggerReAction) {
        endTurnEffects(playerUnit);
        playerUnit.currentMove = playerUnit.moveRange[1];
        statusText.setText("재행동! (턴 효과 적용됨)");
        setTimeout(() => { gameState = STATE.IDLE; updateDB(false); }, 800);
    } else {
        setTimeout(() => { updateDB(true); }, 500);
    }
}

function cancelMove() {
    playerUnit.revertPos();
    gameState = STATE.IDLE; closeActionMenu(); clearHighlights();
}

function updateDB(endTurn) {
    const sPos = toServer(playerUnit.localX, playerUnit.localY);
    const updates = { [`${myRole}Unit`]: { x: sPos.x, y: sPos.y, hp: playerUnit.hp, mp: playerUnit.mp } };
    if (endTurn) updates.turn = myRole === 'p1' ? 'p2' : 'p1';
    window.dbUpdate(window.dbRef(window.db, `rooms/${currentRoomId}`), updates);
}

function setupSync() {
    window.dbOnValue(window.dbRef(window.db, `rooms/${currentRoomId}`), (snap) => {
        const d = snap.val(); if (!d) return;
        if (d.turn === myRole && !isMyTurn) {
            isMyTurn = true; gameState = STATE.IDLE; statusText.setText("내 턴");
            endTurnEffects(playerUnit);
            updateHUD();
        } else if (d.turn !== myRole) { 
            isMyTurn = false; statusText.setText("상대 턴"); 
        }
        
        const enemyRole = myRole === 'p1' ? 'p2' : 'p1';
        const enD = d[`${enemyRole}Unit`];
        if (enD) {
            const localPos = toLocal(enD.x, enD.y);
            enemyUnit.updatePos(localPos.x, localPos.y);
            enemyUnit.hp = enD.hp; enemyUnit.mp = enD.mp;
            enemyUnit.hpText.setText(`${enD.hp}`);
            updateHUD();
        }
    });
}

function endTurnEffects(unit) {
    for (let k in unit.cooldowns) if (unit.cooldowns[k] > 0) unit.cooldowns[k]--;
    if (unit.passive?.name === "마나의 주인") unit.mp = Math.min(unit.maxMp, unit.mp + 30);
    unit.movedDistance = 0;
}

// ★★★ 겹침 방지 적용된 이동 범위 ★★★
function showMoveRange(sx, sy, r) {
    for (let x = 0; x < mapWidth; x++) for (let y = 0; y < mapHeight; y++) {
        const d = Math.abs(x - sx) + Math.abs(y - sy);
        const sPos = toServer(x, y);
        const t = mapData[sPos.x] ? mapData[sPos.x][sPos.y].type : 'Grass';
        
        // 적이 있는 위치는 이동 불가 (x,y는 로컬 좌표이므로 enemyUnit.localX와 비교)
        const isOccupiedByEnemy = (x === enemyUnit.localX && y === enemyUnit.localY);

        if ((t === 'Mountain' || t === 'Water') || d === 0 || d > r || isOccupiedByEnemy) continue;
        
        const p = gridToWorld(x, y); 
        moveHighlights.push({x, y, rect: playerUnit.scene.add.rectangle(p.x, p.y, 50, 50, 0x00f, 0.4)});
    }
}

function showTargetRange(sx, sy, r) {
    for (let x = 0; x < mapWidth; x++) for (let y = 0; y < mapHeight; y++) {
        if (Math.abs(x - sx) + Math.abs(y - sy) <= r) {
            const p = gridToWorld(x, y); 
            moveHighlights.push({x, y, rect: playerUnit.scene.add.rectangle(p.x, p.y, 50, 50, 0xf00, 0.4)});
        }
    }
}

// ★★★ 스킬 UI 디자인 개선 (배경 박스 및 위치 조정) ★★★
function createActionMenu(s) { actionMenuGroup = s.add.container(680, 100); } // 컨테이너 사용

function openActionMenu() {
    actionMenuGroup.removeAll(true);
    
    // 배경 박스
    const bg = playerUnit.scene.add.rectangle(60, 150, 140, 320, 0x000000, 0.8).setStrokeStyle(1, 0xaaaaaa);
    actionMenuGroup.add(bg);

    let y = 0;
    playerUnit.skills.forEach(skill => {
        const cd = playerUnit.cooldowns[skill.id] || 0;
        const isDisabled = cd > 0 || (playerUnit.isReAction && skill.isUltimate);
        
        // 버튼 배경
        const btnBg = playerUnit.scene.add.rectangle(60, y, 120, 40, isDisabled ? 0x444444 : 0x880000).setInteractive();
        const btnTxt = playerUnit.scene.add.text(60, y, skill.name + (cd>0 ? `(${cd})` : ""), { fontSize: '14px', fill: '#fff' }).setOrigin(0.5);
        
        btnBg.on('pointerover', () => { 
            btnBg.setFillStyle(isDisabled ? 0x444444 : 0xaa0000);
            skillDescText.setText(`[${skill.name}]\n${skill.desc}`).setVisible(true);
        });
        btnBg.on('pointerout', () => { 
            btnBg.setFillStyle(isDisabled ? 0x444444 : 0x880000);
            skillDescText.setText("캐릭터를 조작하거나 스킬에 마우스를 올리면 설명이 나옵니다.");
        });
        
        if (!isDisabled) {
            btnBg.on('pointerdown', () => {
                selectedSkill = skill;
                if (skill.range > 0) { 
                    gameState = STATE.TARGET_SELECT; clearHighlights(); showTargetRange(reservedX, reservedY, skill.range); 
                } else executeAction(skill, playerUnit);
            });
        }
        
        actionMenuGroup.add(btnBg);
        actionMenuGroup.add(btnTxt);
        y += 50;
    });

    // 대기 버튼
    const waitBg = playerUnit.scene.add.rectangle(60, y, 120, 40, 0x000088).setInteractive();
    const waitTxt = playerUnit.scene.add.text(60, y, "대기", { fontSize: '14px' }).setOrigin(0.5);
    waitBg.on('pointerdown', () => executeAction({id: 'WAIT'}, null));
    actionMenuGroup.add(waitBg); actionMenuGroup.add(waitTxt); y += 50;

    // 취소 버튼
    const cancelBg = playerUnit.scene.add.rectangle(60, y, 120, 40, 0x444444).setInteractive();
    const cancelTxt = playerUnit.scene.add.text(60, y, "이동 취소", { fontSize: '14px' }).setOrigin(0.5);
    cancelBg.on('pointerdown', () => cancelMove());
    actionMenuGroup.add(cancelBg); actionMenuGroup.add(cancelTxt);
}

function closeActionMenu() { actionMenuGroup.removeAll(true); }
function clearHighlights() { moveHighlights.forEach(h => h.rect.destroy()); moveHighlights = []; }
function isHighlighted(x, y) { return moveHighlights.some(h => h.x === x && h.y === y); }
