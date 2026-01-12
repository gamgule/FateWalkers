// ==========================================
// [Part 0] 맵 생성 및 동기화 클래스
// ==========================================
class MapGenerator {
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
                    else if (rand < 0.35) type = 'Sand';     // 일반 지형
                }
                if ((x===3 && y===1) || (x===3 && y===8)) type = 'Grass';
                map[x][y] = { type: type };
            }
        }
        return map;
    }
}

// ==========================================
// [Part 1] 전역 변수 및 설정
// ==========================================
let myRole = null; 
let currentRoomId = null; 
let isMyTurn = false;    
let selectedCharKey = null; 
let game = null;

const lobbyScreen = document.getElementById('lobby-screen');
const charSelectScreen = document.getElementById('char-select-screen');
const gameContainer = document.getElementById('game-container');
const statusMsg = document.getElementById('status-msg');
const matchBtn = document.getElementById('find-match-btn');

window.selectedChars = { host: null, guest: null };

// === 데이터베이스 (DB) ===
const DB = {
    SKILLS: {
        SLASH: { name: "베기", power: 25, range: 1, cooldown: 0, desc: "근접한 적을 기본 공격합니다." },
        UPPER_SLASH: { name: "상단 베기", power: 50, range: 1, cooldown: 3, desc: "강력한 일격으로 큰 피해를 줍니다." },
        GUARD: { name: "가드", type: "buff", cooldown: 2, range: 0, desc: "방어 태세를 갖춰 다음 턴까지 피해를 줄입니다." },
        SHIELD_THROW: { name: "방패 던지기", power: 30, range: 4, triggerReAction: true, isUltimate: true, desc: "[궁극기] 방패를 던져 공격 후 즉시 재행동합니다." },
        MAGIC_MISSILE: { name: "매직미사일", power: 20, range: 5, cost: 10, cooldown: 0, desc: "마력 화살을 날립니다. MP 10 소모." },
        FIREBALL: { name: "파이어볼", power: 30, range: 5, cost: 20, cooldown: 2, desc: "화염구를 발사합니다. MP 20 소모." },
        INFERNITY: { name: "인페르니티", power: 110, range: 8, cost: 100, cooldown: 5, isUltimate: true, desc: "[궁극기] 모든 마력을 쏟아붓습니다. MP 100 소모." },
        STEALTH: { name: "은신", type: "buff", range: 0, cooldown: 4, triggerReAction: true, desc: "몸을 숨겨 적의 시야에서 벗어나고 재행동합니다." },
        BACKSTAB: { name: "배후노리기", power: 60, range: 6, cooldown: 0, isUltimate: true, reqStealth: true, teleportBehind: true, desc: "[궁극기] 은신 중 적의 뒤로 순간이동하여 급소를 찌릅니다." }
    },
    CHARACTERS: {
        KNIGHT: { 
            name: "기사", hp: 120, mp: 0, move: [3, 4], skills: ["SLASH", "UPPER_SLASH", "GUARD", "SHIELD_THROW"], color: '#C0C0C0',
            desc: "높은 체력의 탱커입니다. 가드로 버티며 방패 던지기로 기회를 만듭니다."
        },
        MAGE: { 
            name: "마법사", hp: 100, mp: 100, move: [2, 3], skills: ["MAGIC_MISSILE", "FIREBALL", "INFERNITY"], color: '#9C27B0',
            desc: "원거리 마법 딜러입니다. MP 관리가 중요하며 강력한 한방을 가집니다."
        },
        NINJA: { 
            name: "닌자", hp: 85, mp: 0, move: [4, 5], skills: ["STEALTH", "BACKSTAB"], color: '#333333',
            desc: "기동력이 높은 암살자입니다. 은신 후 적의 뒤를 노리는 데 특화되어 있습니다."
        }
    }
};

let mapData = [], visualGrid = [];
const mapWidth = 7, mapHeight = 9, gridSize = 60;
let playerUnit, enemyUnit; 
let gameState = 0; 
let statusText, actionMenuGroup, skillDescText;
let reservedX, reservedY, selectedSkill; 
let moveHighlights = [];

const STATE = { IDLE: 0, MOVE_SELECT: 1, ACTION_WAIT: 2, TARGET_SELECT: 3, BUSY: 4, ENEMY_TURN: 5 };

// ==========================================
// [Part 2] 시스템 및 매칭 로직
// ==========================================
matchBtn.addEventListener('click', () => {
    if (!window.db) return;
    matchBtn.disabled = true;
    findMatch();
});

function findMatch() {
    const roomsRef = window.dbRef(window.db, 'rooms');
    window.dbGet(roomsRef).then((snapshot) => {
        const rooms = snapshot.val();
        let foundRoom = null;
        if (rooms) {
            for (let id in rooms) if (rooms[id].status === 'waiting') { foundRoom = id; break; }
        }
        if (foundRoom) joinRoom(foundRoom); else createRoom();
    });
}

function createRoom() {
    const newRoomRef = window.dbPush(window.dbRef(window.db, 'rooms'));
    currentRoomId = newRoomRef.key;
    myRole = 'host';
    const mapGen = new MapGenerator(mapWidth, mapHeight);
    window.dbSet(newRoomRef, {
        status: 'waiting', turn: 'host', map: mapGen.generate(), turnCount: 1
    });
    window.dbOnValue(newRoomRef, (snap) => { if (snap.val()?.status === 'selecting') onMatchFound(); });
}

function joinRoom(roomId) {
    currentRoomId = roomId; myRole = 'guest';
    window.dbUpdate(window.dbRef(window.db, `rooms/${roomId}`), { status: 'selecting' });
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
    const infoBox = document.getElementById('char-info-box'); // HTML에 이 ID의 div 필요
    charGrid.innerHTML = '';

    Object.keys(DB.CHARACTERS).forEach(key => {
        const char = DB.CHARACTERS[key];
        const btn = document.createElement('div');
        btn.innerText = char.name;
        btn.style.cssText = `width:100px; height:50px; background:${char.color}; cursor:pointer; display:flex; align-items:center; justify-content:center; border:2px solid #fff; color:white; font-weight:bold;`;
        
        btn.onmouseenter = () => infoBox.innerText = char.desc;
        btn.onmouseleave = () => infoBox.innerText = "캐릭터에 마우스를 올려보세요.";
        btn.onclick = () => {
            selectedCharKey = key;
            window.dbUpdate(window.dbRef(window.db, `rooms/${currentRoomId}`), { [`${myRole}Char`]: key });
            lockInBtn.disabled = false;
        };
        charGrid.appendChild(btn);
    });

    lockInBtn.onclick = () => {
        window.dbUpdate(window.dbRef(window.db, `rooms/${currentRoomId}`), { [`${myRole}Ready`]: true });
        lockInBtn.disabled = true;
    };

    window.dbOnValue(window.dbRef(window.db, `rooms/${currentRoomId}`), (snap) => {
        const data = snap.val();
        if (data.hostReady && data.guestReady && data.status !== 'playing') {
            window.selectedChars.host = data.hostChar;
            window.selectedChars.guest = data.guestChar;
            mapData = data.map;
            if (myRole === 'host') window.dbUpdate(window.dbRef(window.db, `rooms/${currentRoomId}`), { status: 'playing' });
            charSelectScreen.style.display = 'none';
            startGameUI();
        }
    });
}

function startGameUI() {
    gameContainer.style.display = 'block';
    if (!game) game = new Phaser.Game(config);
}

// ==========================================
// [Part 3] 전투 시스템 및 유닛
// ==========================================
class Unit {
    constructor(scene, data, x, y, isMe) {
        this.scene = scene;
        this.name = data.name;
        this.hp = data.hp; this.maxHp = data.hp;
        this.x = x; this.y = y;
        this.isMe = isMe;
        this.skills = data.skills.map(k => ({...DB.SKILLS[k], id: k}));
        this.moveRange = data.move;
        this.cooldowns = {};
        this.isReAction = false;

        const pos = gridToWorld(x, y);
        this.sprite = scene.add.rectangle(pos.x, pos.y, 40, 40, Phaser.Display.Color.HexStringToColor(data.color).color);
        this.hpText = scene.add.text(pos.x, pos.y - 35, `${this.hp}/${this.maxHp}`, { fontSize: '14px', fill: '#fff' }).setOrigin(0.5);
    }
    updatePos(gx, gy) {
        this.x = gx; this.y = gy;
        const pos = gridToWorld(gx, gy);
        this.sprite.x = pos.x; this.sprite.y = pos.y;
        this.hpText.x = pos.x; this.hpText.y = pos.y - 35;
    }
    takeDamage(dmg) {
        this.hp -= dmg;
        this.hpText.setText(`${this.hp}/${this.maxHp}`);
        return this.hp <= 0;
    }
}

const config = {
    type: Phaser.AUTO, parent: 'game-container', width: 800, height: 600,
    backgroundColor: '#111', scene: { preload: preload, create: create }
};

function preload() {}

function create() {
    const startX = (800 - (mapWidth * gridSize)) / 2;
    const startY = (600 - (mapHeight * gridSize)) / 2;

    for (let x = 0; x < mapWidth; x++) {
        visualGrid[x] = [];
        for (let y = 0; y < mapHeight; y++) {
            const type = mapData[x][y].type;
            let color = 0x4CAF50;
            if (type === 'Water') color = 0x2196F3;
            if (type === 'Mountain') color = 0x757575;
            if (type === 'Sand') color = 0xF0E68C;

            const tile = this.add.rectangle(startX + x*gridSize + 30, startY + y*gridSize + 30, 58, 58, color).setInteractive();
            visualGrid[x][y] = tile;
            tile.on('pointerdown', () => onTileClick(x, y));
        }
    }

    const myChar = (myRole === 'host') ? window.selectedChars.host : window.selectedChars.guest;
    const enemyChar = (myRole === 'host') ? window.selectedChars.guest : window.selectedChars.host;
    playerUnit = new Unit(this, DB.CHARACTERS[myChar], 3, (myRole === 'host' ? 8 : 1), true);
    enemyUnit = new Unit(this, DB.CHARACTERS[enemyChar], 3, (myRole === 'host' ? 1 : 8), false);

    statusText = this.add.text(10, 10, "대전 준비...", { fontSize: '20px' });
    skillDescText = this.add.text(400, 560, "", { fontSize: '14px', backgroundColor: '#000000aa', padding: 5 }).setOrigin(0.5).setVisible(false);
    
    createActionMenu(this);
    setupSync();
}

function onTileClick(x, y) {
    if (!isMyTurn || gameState === STATE.BUSY) return;

    if (gameState === STATE.IDLE && x === playerUnit.x && y === playerUnit.y) {
        clearHighlights();
        const moveVal = Phaser.Math.Between(playerUnit.moveRange[0], playerUnit.moveRange[1]);
        showMoveRange(playerUnit.x, playerUnit.y, moveVal);
        gameState = STATE.MOVE_SELECT;
    } 
    else if (gameState === STATE.MOVE_SELECT && isHighlighted(x, y)) {
        reservedX = x; reservedY = y;
        clearHighlights();
        const pos = gridToWorld(x, y);
        moveHighlights.push({x, y, rect: playerUnit.scene.add.circle(pos.x, pos.y, 8, 0xffffff)});
        gameState = STATE.ACTION_WAIT;
        openActionMenu();
    }
    else if (gameState === STATE.TARGET_SELECT && isHighlighted(x, y)) {
        if (x === enemyUnit.x && y === enemyUnit.y) executeAction(selectedSkill, enemyUnit);
        else if (selectedSkill.range === 0 && x === reservedX && y === reservedY) executeAction(selectedSkill, playerUnit);
    }
}

function showMoveRange(sx, sy, range) {
    for (let x = 0; x < mapWidth; x++) {
        for (let y = 0; y < mapHeight; y++) {
            const dist = Math.abs(x - sx) + Math.abs(y - sy);
            const type = mapData[x][y].type;
            if (type === 'Mountain' || type === 'Water') continue; // 산, 물 이동 불가
            if (dist > 0 && dist <= range) {
                const pos = gridToWorld(x, y);
                moveHighlights.push({x, y, rect: playerUnit.scene.add.rectangle(pos.x, pos.y, 50, 50, 0x0000ff, 0.4)});
            }
        }
    }
}

function executeAction(skill, target) {
    gameState = STATE.BUSY; closeActionMenu(); clearHighlights();
    playerUnit.updatePos(reservedX, reservedY);

    if (skill.id !== 'WAIT') {
        if (skill.cooldown > 0) playerUnit.cooldowns[skill.id] = skill.cooldown;
        if (skill.power && target) target.takeDamage(skill.power);
        if (skill.triggerReAction && !playerUnit.isReAction) {
            playerUnit.isReAction = true; statusText.setText("재행동 가능!");
            gameState = STATE.IDLE; updateSync(false); return;
        }
    }
    playerUnit.isReAction = false;
    updateSync(true);
}

function updateSync(endTurn) {
    const roomRef = window.dbRef(window.db, `rooms/${currentRoomId}`);
    const updates = { [`${myRole}Unit`]: { x: playerUnit.x, y: playerUnit.y, hp: playerUnit.hp } };
    if (endTurn) updates.turn = (myRole === 'host' ? 'guest' : 'host');
    window.dbUpdate(roomRef, updates);
}

function setupSync() {
    window.dbOnValue(window.dbRef(window.db, `rooms/${currentRoomId}`), (snap) => {
        const data = snap.val();
        if (data.turn === myRole && !isMyTurn) {
            isMyTurn = true; gameState = STATE.IDLE; statusText.setText("나의 턴");
            for (let k in playerUnit.cooldowns) if (playerUnit.cooldowns[k] > 0) playerUnit.cooldowns[k]--;
        } else if (data.turn !== myRole) {
            isMyTurn = false; statusText.setText("상대 대기 중...");
        }
        const enemyData = data[myRole === 'host' ? 'guestUnit' : 'hostUnit'];
        if (enemyData) enemyUnit.updatePos(enemyData.x, enemyData.y);
    });
}

function gridToWorld(x, y) {
    const startX = (800 - (mapWidth * gridSize)) / 2;
    const startY = (600 - (mapHeight * gridSize)) / 2;
    return { x: startX + x*gridSize + 30, y: startY + y*gridSize + 30 };
}
function clearHighlights() { moveHighlights.forEach(h => h.rect.destroy()); moveHighlights = []; }
function isHighlighted(x, y) { return moveHighlights.some(h => h.x === x && h.y === y); }

function createActionMenu(scene) { actionMenuGroup = scene.add.group(); }

function openActionMenu() {
    actionMenuGroup.clear(true, true);
    let y = 150;
    playerUnit.skills.forEach(skill => {
        const cd = playerUnit.cooldowns[skill.id] || 0;
        const isDisabled = cd > 0 || (playerUnit.isReAction && skill.isUltimate);
        
        const btn = playerUnit.scene.add.text(700, y, skill.name + (cd>0 ? `(${cd})` : ""), {
            backgroundColor: isDisabled ? '#444' : '#900', padding: 6, fixedWidth: 120, align: 'center'
        }).setInteractive();
        
        btn.on('pointerover', () => {
            skillDescText.setText(`[${skill.name}] ${skill.desc}`).setVisible(true);
        });
        btn.on('pointerout', () => skillDescText.setVisible(false));

        if (!isDisabled) {
            btn.on('pointerdown', () => {
                skillDescText.setVisible(false);
                selectedSkill = skill;
                if (skill.range > 0) {
                    gameState = STATE.TARGET_SELECT; clearHighlights();
                    showTargetRange(reservedX, reservedY, skill.range);
                } else executeAction(skill, playerUnit);
            });
        }
        actionMenuGroup.add(btn); y += 45;
    });
    const waitBtn = playerUnit.scene.add.text(700, y, "대기", { backgroundColor: '#006', padding: 6, fixedWidth: 120, align: 'center' }).setInteractive();
    waitBtn.on('pointerdown', () => executeAction({id: 'WAIT'}, null));
    actionMenuGroup.add(waitBtn);
}

function showTargetRange(sx, sy, range) {
    for (let x = 0; x < mapWidth; x++) {
        for (let y = 0; y < mapHeight; y++) {
            if (Math.abs(x - sx) + Math.abs(y - sy) <= range) {
                const pos = gridToWorld(x, y);
                moveHighlights.push({x, y, rect: playerUnit.scene.add.rectangle(pos.x, pos.y, 50, 50, 0xff0000, 0.4)});
            }
        }
    }
}

function closeActionMenu() { actionMenuGroup.clear(true, true); skillDescText.setVisible(false); }
