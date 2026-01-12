// ==========================================
// [Part 0] 맵 생성 및 클래스 중복 방지
// ==========================================
if (typeof window.MapGenerator === 'undefined') {
    window.MapGenerator = class MapGenerator {
        constructor(width, height) {
            this.width = width;
            this.height = height;
        }
        generate() {
            let map = [];
            for (let x = 0; x < this.width; x++) {
                map[x] = [];
                for (let y = 0; y < this.height; y++) {
                    let type = 'Grass'; 
                    const isCenter = (x >= 2 && x <= 4 && y >= 3 && y <= 5);
                    const rand = Math.random();
                    if (!isCenter) {
                        if (rand < 0.15) type = 'Water';    // 이동 불가
                        else if (rand < 0.25) type = 'Mountain'; // 이동 불가
                        else if (rand < 0.35) type = 'Sand';     // 일반
                    }
                    if ((x===3 && y===1) || (x===3 && y===8)) type = 'Grass';
                    map[x][y] = { type: type };
                }
            }
            return map;
        }
    };
}

// ==========================================
// [Part 1] 전역 변수 및 DB (5개 캐릭터 완전체)
// ==========================================
let myRole = null; let currentRoomId = null; let isMyTurn = false;
let selectedCharKey = null; let game = null;

const lobbyScreen = document.getElementById('lobby-screen');
const charSelectScreen = document.getElementById('char-select-screen');
const gameContainer = document.getElementById('game-container');
const infoBox = document.getElementById('char-info-box');

const DB = {
    SKILLS: {
        SLASH: { name: "베기", power: 25, range: 1, cooldown: 0, desc: "근접 기본 공격입니다." },
        UPPER_SLASH: { name: "상단 베기", power: 50, range: 1, cooldown: 3, desc: "강력한 일격을 가합니다." },
        GUARD: { name: "가드", type: "buff", range: 0, cooldown: 2, desc: "방어 태세로 피해를 줄입니다." },
        SHIELD_THROW: { name: "방패 던지기", power: 30, range: 4, triggerReAction: true, isUltimate: true, desc: "[궁극기] 공격 후 재행동." },
        MAGIC_MISSILE: { name: "매직미사일", power: 20, range: 5, cost: 10, cooldown: 0, desc: "마력 화살 발사. MP 10." },
        FIREBALL: { name: "파이어볼", power: 35, range: 5, cost: 20, cooldown: 2, desc: "화염구 발사. MP 20." },
        INFERNITY: { name: "인페르니티", power: 110, range: 8, cost: 100, cooldown: 5, isUltimate: true, desc: "[궁극기] 초강력 마법. MP 100." },
        STEALTH: { name: "은신", type: "buff", range: 0, cooldown: 4, triggerReAction: true, desc: "은신 후 재행동." },
        BACKSTAB: { name: "배후노리기", power: 65, range: 6, cooldown: 0, isUltimate: true, reqStealth: true, teleportBehind: true, desc: "[궁극기] 적 뒤로 순간이동 습격." },
        SNIPE: { name: "저격", power: 25, range: 6, cooldown: 0, desc: "먼 거리의 적을 저격합니다." },
        HEADSHOT: { name: "헤드샷", power: 80, range: 8, cooldown: 5, isUltimate: true, desc: "[궁극기] 치명적인 일격." },
        DAGGER_STAB: { name: "단검 찌르기", power: 20, range: 1, cooldown: 0, desc: "기본 단검 공격." },
        AMBUSH_STRIKE: { name: "석궁 쇄도", power: 10, range: 5, cooldown: 4, isUltimate: true, desc: "[궁극기] 이동 거리 비례 데미지." }
    },
    CHARACTERS: {
        KNIGHT: { name: "기사", hp: 120, mp: 0, move: [3, 4], skills: ["SLASH", "UPPER_SLASH", "GUARD", "SHIELD_THROW"], color: '#C0C0C0', art: 'knight_art', desc: "공수 밸런스가 좋은 탱커 유닛." },
        MAGE: { name: "마법사", hp: 100, mp: 100, move: [2, 3], skills: ["MAGIC_MISSILE", "FIREBALL", "INFERNITY"], color: '#9C27B0', art: 'mage_art', desc: "마법으로 적을 제압하는 딜러." },
        NINJA: { name: "닌자", hp: 85, mp: 0, move: [4, 5], skills: ["STEALTH", "BACKSTAB"], color: '#333333', art: 'ninja_art', desc: "은신과 기습에 특화된 암살자." },
        BOW_MASTER: { name: "보우 마스터", hp: 90, mp: 0, move: [3, 4], skills: ["SNIPE", "HEADSHOT"], color: '#2E7D32', art: 'archer_art', desc: "초장거리 저격에 특화된 궁수." },
        PATHFINDER: { name: "패스파인더", hp: 95, mp: 0, move: [4, 6], skills: ["DAGGER_STAB", "AMBUSH_STRIKE"], color: '#FF6F00', art: 'pathfinder_art', desc: "이동 거리에 따라 위력이 변하는 정찰병." }
    }
};

let mapData = []; let visualGrid = []; const mapWidth = 7; const mapHeight = 9; const gridSize = 60;
let playerUnit; let enemyUnit; let gameState = 0; let statusText; let actionMenuGroup; let skillDescText;
let reservedX; let reservedY; let selectedSkill; let moveHighlights = [];
const STATE = { IDLE: 0, MOVE_SELECT: 1, ACTION_WAIT: 2, TARGET_SELECT: 3, BUSY: 4 };

// ==========================================
// [Part 2] 매칭 및 캐릭터 선택 로직
// ==========================================
document.getElementById('find-match-btn').onclick = () => {
    if (!window.db) return;
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
    currentRoomId = ref.key; myRole = 'host';
    const mapGen = new MapGenerator(mapWidth, mapHeight);
    window.dbSet(ref, { status: 'waiting', turn: 'host', map: mapGen.generate(), hostReady: false, guestReady: false });
    window.dbOnValue(ref, (s) => { if (s.val()?.status === 'selecting') onMatchFound(); });
}

function joinRoom(id) {
    currentRoomId = id; myRole = 'guest';
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
        const btn = document.createElement('div');
        btn.innerText = c.name; btn.style.cssText = `width:100px; height:50px; background:${c.color}; border:2px solid #fff; cursor:pointer; color:white; font-weight:bold; display:flex; align-items:center; justify-content:center;`;
        btn.onmouseenter = () => { if(infoBox) infoBox.innerText = c.desc; };
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
    document.getElementById('lock-in-btn').innerText = "준비 완료";
};

// 실시간 데이터 감시 및 시작
window.addEventListener('load', () => {
    setInterval(() => {
        if (!currentRoomId) return;
        window.dbGet(window.dbRef(window.db, `rooms/${currentRoomId}`)).then((snap) => {
            const d = snap.val(); if (!d) return;
            if (d.hostReady && d.guestReady && d.status !== 'playing') {
                window.selectedChars = { host: d.hostChar, guest: d.guestChar };
                mapData = d.map;
                if (myRole === 'host') window.dbUpdate(window.dbRef(window.db, `rooms/${currentRoomId}`), { status: 'playing' });
                charSelectScreen.style.display = 'none'; gameContainer.style.display = 'block';
                if (!game) game = new Phaser.Game(config);
            }
        });
    }, 1000);
});

// ==========================================
// [Part 3] 전투 시스템 (Phaser)
// ==========================================
class Unit {
    constructor(scene, data, x, y, isMe) {
        this.scene = scene; this.name = data.name; this.hp = data.hp; this.maxHp = data.hp;
        this.x = x; this.y = y; this.isMe = isMe;
        this.skills = data.skills.map(k => ({...DB.SKILLS[k], id: k}));
        this.moveRange = data.move; this.cooldowns = {}; this.isReAction = false;
        const pos = gridToWorld(x, y);
        this.sprite = scene.add.sprite(pos.x, pos.y, data.art).setScale(1.5);
        if (!isMe) this.sprite.setTint(0xff8888);
        this.hpText = scene.add.text(pos.x, pos.y - 35, `${this.hp}/${this.maxHp}`, { fontSize: '14px', fontStyle: 'bold' }).setOrigin(0.5);
    }
    updatePos(gx, gy) {
        this.x = gx; this.y = gy; const pos = gridToWorld(gx, gy);
        this.sprite.x = pos.x; this.sprite.y = pos.y; this.hpText.x = pos.x; this.hpText.y = pos.y - 35;
    }
    takeDamage(d) { this.hp -= d; this.hpText.setText(`${this.hp}/${this.maxHp}`); return this.hp <= 0; }
}

const config = {
    type: Phaser.AUTO, parent: 'game-container', width: 800, height: 600,
    backgroundColor: '#1a1a1a', scene: { preload: preload, create: create }
};

function preload() {
    const createArt = (key, colors, pixels) => {
        const canvas = this.textures.createCanvas(key, 32, 32);
        const ctx = canvas.context;
        const size = 32 / pixels.length;
        for(let y=0; y<pixels.length; y++) {
            for(let x=0; x<pixels[y].length; x++) {
                if(pixels[y][x] !== ' ') {
                    ctx.fillStyle = colors[pixels[y][x]];
                    ctx.fillRect(x*size, y*size, size, size);
                }
            }
        }
        canvas.refresh();
    };
    createArt('knight_art', {'s':'#C0C0C0','f':'#FFCC99','r':'#FF0000','b':'#4169E1'}, ["  ssss  "," ssrrss "," ssssss ","  ffff  ","  bbbb  "," ggssgg ","  s  s  "]);
    createArt('mage_art', {'p':'#800080','f':'#FFCC99','y':'#FFD700'}, ["  pppp  "," pppppp ","  ffff  ","  pppp  "," yppppppy","  p  p  "]);
    createArt('ninja_art', {'k':'#1a1a1a','r':'#8b0000','s':'#fff'}, ["  kkkk  "," kkkkkk "," kskksk ","  ffff  ","  kkkk  "," krrkkr ","  k  k  "]);
    createArt('archer_art', {'g':'#2E7D32','b':'#8B4513','f':'#FFCC99'}, ["  gggg  "," ggggb b","  ffff  ","  gggg  "," bgggggb","  g  g  "]);
    createArt('pathfinder_art', {'o':'#FF6F00','b':'#444','f':'#FFCC99'}, ["  oooo  "," oooooo ","  ffff  ","  bbbb  "," obbbbo ","  b  b  "]);
}

function create() {
    const sX = (800 - (mapWidth * gridSize)) / 2; const sY = (600 - (mapHeight * gridSize)) / 2;
    for (let x = 0; x < mapWidth; x++) {
        visualGrid[x] = [];
        for (let y = 0; y < mapHeight; y++) {
            const type = mapData[x][y].type;
            let color = type === 'Water' ? 0x1a4a7a : type === 'Mountain' ? 0x4a4a4a : type === 'Sand' ? 0x8a7a4a : 0x3d5e3a;
            const tile = this.add.rectangle(sX + x*gridSize + 30, sY + y*gridSize + 30, 56, 56, color).setStrokeStyle(2, 0x000, 0.5).setInteractive();
            visualGrid[x][y] = tile; tile.on('pointerdown', () => onTileClick(x, y));
        }
    }
    const myK = myRole === 'host' ? window.selectedChars.host : window.selectedChars.guest;
    const enK = myRole === 'host' ? window.selectedChars.guest : window.selectedChars.host;
    playerUnit = new Unit(this, DB.CHARACTERS[myK], 3, myRole === 'host' ? 8 : 1, true);
    enemyUnit = new Unit(this, DB.CHARACTERS[enK], 3, myRole === 'host' ? 1 : 8, false);
    statusText = this.add.text(10, 10, "전투 시작", { fontSize: '20px' });
    skillDescText = this.add.text(400, 560, "", { fontSize: '14px', backgroundColor: '#000c', padding: 8 }).setOrigin(0.5).setVisible(false);
    createActionMenu(this); setupSync();
}

function onTileClick(x, y) {
    if (!isMyTurn || gameState === STATE.BUSY) return;
    if (gameState === STATE.IDLE && x === playerUnit.x && y === playerUnit.y) {
        clearHighlights(); showMoveRange(x, y, Phaser.Math.Between(playerUnit.moveRange[0], playerUnit.moveRange[1]));
        gameState = STATE.MOVE_SELECT;
    } else if (gameState === STATE.MOVE_SELECT && isHighlighted(x, y)) {
        reservedX = x; reservedY = y; clearHighlights();
        const p = gridToWorld(x, y); moveHighlights.push({x, y, rect: playerUnit.scene.add.circle(p.x, p.y, 8, 0xfff)});
        gameState = STATE.ACTION_WAIT; openActionMenu();
    } else if (gameState === STATE.TARGET_SELECT && isHighlighted(x, y)) {
        if (x === enemyUnit.x && y === enemyUnit.y) executeAction(selectedSkill, enemyUnit);
        else if (selectedSkill.range === 0 && x === reservedX && y === reservedY) executeAction(selectedSkill, playerUnit);
    }
}

function showMoveRange(sx, sy, r) {
    for (let x = 0; x < mapWidth; x++) for (let y = 0; y < mapHeight; y++) {
        const d = Math.abs(x - sx) + Math.abs(y - sy); const t = mapData[x][y].type;
        if (t === 'Mountain' || t === 'Water' || d === 0 || d > r) continue;
        const p = gridToWorld(x, y); moveHighlights.push({x, y, rect: playerUnit.scene.add.rectangle(p.x, p.y, 50, 50, 0x00f, 0.4)});
    }
}

function executeAction(s, t) {
    gameState = STATE.BUSY; closeActionMenu(); clearHighlights(); playerUnit.updatePos(reservedX, reservedY);
    if (s.id !== 'WAIT') {
        if (s.cooldown > 0) playerUnit.cooldowns[s.id] = s.cooldown;
        if (s.power && t) t.takeDamage(s.power);
        if (s.triggerReAction && !playerUnit.isReAction) {
            playerUnit.isReAction = true; gameState = STATE.IDLE; updateSync(false); return;
        }
    }
    playerUnit.isReAction = false; updateSync(true);
}

function updateSync(end) {
    const updates = { [`${myRole}Unit`]: { x: playerUnit.x, y: playerUnit.y, hp: playerUnit.hp } };
    if (end) updates.turn = myRole === 'host' ? 'guest' : 'host';
    window.dbUpdate(window.dbRef(window.db, `rooms/${currentRoomId}`), updates);
}

function setupSync() {
    window.dbOnValue(window.dbRef(window.db, `rooms/${currentRoomId}`), (snap) => {
        const d = snap.val(); if (!d) return;
        if (d.turn === myRole && !isMyTurn) {
            isMyTurn = true; gameState = STATE.IDLE; statusText.setText("내 턴");
            for (let k in playerUnit.cooldowns) if (playerUnit.cooldowns[k] > 0) playerUnit.cooldowns[k]--;
        } else if (d.turn !== myRole) { isMyTurn = false; statusText.setText("상대 턴"); }
        const enD = d[myRole === 'host' ? 'guestUnit' : 'hostUnit'];
        if (enD) enemyUnit.updatePos(enD.x, enD.y);
    });
}

function gridToWorld(x, y) {
    const sX = (800 - (mapWidth * gridSize)) / 2; const sY = (600 - (mapHeight * gridSize)) / 2;
    return { x: sX + x*gridSize + 30, y: sY + y*gridSize + 30 };
}
function clearHighlights() { moveHighlights.forEach(h => h.rect.destroy()); moveHighlights = []; }
function isHighlighted(x, y) { return moveHighlights.some(h => h.x === x && h.y === y); }
function createActionMenu(s) { actionMenuGroup = s.add.group(); }

function openActionMenu() {
    actionMenuGroup.clear(true, true); let y = 150;
    playerUnit.skills.forEach(s => {
        const cd = playerUnit.cooldowns[s.id] || 0;
        const dis = cd > 0 || (playerUnit.isReAction && s.isUltimate);
        const btn = playerUnit.scene.add.text(700, y, s.name + (cd>0 ? `(${cd})` : ""), {
            backgroundColor: dis ? '#444' : '#900', padding: 8, fixedWidth: 120, align: 'center'
        }).setInteractive();
        btn.on('pointerover', () => skillDescText.setText(`[${s.name}] ${s.desc}`).setVisible(true));
        btn.on('pointerout', () => skillDescText.setVisible(false));
        if (!dis) btn.on('pointerdown', () => {
            skillDescText.setVisible(false); selectedSkill = s;
            if (s.range > 0) { gameState = STATE.TARGET_SELECT; clearHighlights(); showTargetRange(reservedX, reservedY, s.range); }
            else executeAction(s, playerUnit);
        });
        actionMenuGroup.add(btn); y += 50;
    });
    const wBtn = playerUnit.scene.add.text(700, y, "대기", { backgroundColor: '#005', padding: 8, fixedWidth: 120, align: 'center' }).setInteractive();
    wBtn.on('pointerdown', () => executeAction({id: 'WAIT'}, null)); actionMenuGroup.add(wBtn);
}

function showTargetRange(sx, sy, r) {
    for (let x = 0; x < mapWidth; x++) for (let y = 0; y < mapHeight; y++) {
        if (Math.abs(x - sx) + Math.abs(y - sy) <= r) {
            const p = gridToWorld(x, y); moveHighlights.push({x, y, rect: playerUnit.scene.add.rectangle(p.x, p.y, 50, 50, 0xf00, 0.4)});
        }
    }
}

function closeActionMenu() { actionMenuGroup.clear(true, true); skillDescText.setVisible(false); }
