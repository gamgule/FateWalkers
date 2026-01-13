// ==========================================
// [Part 0] 맵 생성 (가로형 11x7)
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
                    // 중앙 지역은 비워둠 (스폰 지역 보호)
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
// [Part 1] 데이터베이스 (5종 캐릭터 스펙 유지)
// ==========================================
const DB = {
    SKILLS: {
        // 기사
        SLASH: { name: "베기", power: 25, range: 1, cooldown: 0, desc: "기본 근접 공격" },
        UPPER_SLASH: { name: "상단 베기", power: 50, range: 1, cooldown: 3, desc: "강력한 일격" },
        GUARD: { name: "가드", type: "buff", range: 0, cooldown: 2, desc: "방어 태세 (피해 감소)" },
        SHIELD_THROW: { name: "방패 던지기", power: 30, range: 4, triggerReAction: true, isUltimate: true, desc: "타격 후 즉시 재행동" },
        // 마법사
        MAGIC_MISSILE: { name: "매직미사일", power: 20, range: 5, cost: 10, cooldown: 0, desc: "마력 화살 (MP 10)" },
        FIREBALL: { name: "파이어볼", power: 35, range: 5, cost: 20, cooldown: 2, desc: "화염구 (MP 20)" },
        INFERNITY: { name: "인페르니티", power: 110, range: 8, cost: 100, cooldown: 5, isUltimate: true, desc: "최강 마법 (MP 100)" },
        // 닌자
        STEALTH: { name: "은신", type: "buff", range: 0, cooldown: 4, triggerReAction: true, desc: "은신 상태 및 재행동" },
        BACKSTAB: { name: "배후노리기", power: 65, range: 6, cooldown: 0, isUltimate: true, reqStealth: true, teleportBehind: true, desc: "적 뒤로 이동 공격" },
        // 보우마스터 (복구됨)
        HURRICANE: { name: "폭풍의 시", power: 15, range: 6, hits: 3, cooldown: 0, desc: "15데미지 x 3발 연사" },
        QUIVER_CARTRIDGE: { name: "퀴버 카트리지", type: "buff", range: 0, cooldown: 3, triggerReAction: true, desc: "특수 화살 장전 및 재행동" },
        ARROW_PLATTER: { name: "애로우 플래터", power: 60, range: 7, cooldown: 4, isUltimate: true, desc: "지정 위치 강력한 사격" },
        // 패스파인더 (복구됨)
        CARDINAL_DISCHARGE: { name: "카디널 디스차지", power: 30, range: 5, cooldown: 0, addGauge: 20, desc: "유도 사격 (게이지 +20)" },
        RELIC_EVOLUTION: { name: "렐릭 에볼루션", type: "buff", range: 0, cooldown: 5, triggerReAction: true, addGauge: 50, desc: "게이지 +50 및 재행동" },
        ANCIENT_ASTRA: { name: "에인션트 아스트라", power: 100, range: 7, reqGauge: 100, isUltimate: true, desc: "게이지 100 소모 궁극기" }
    },
    CHARACTERS: {
        KNIGHT: { name: "기사", hp: 120, mp: 0, move: [3, 4], skills: ["SLASH", "UPPER_SLASH", "GUARD", "SHIELD_THROW"], color: '#C0C0C0', art: 'knight_art' },
        MAGE: { name: "마법사", hp: 100, mp: 100, move: [2, 3], skills: ["MAGIC_MISSILE", "FIREBALL", "INFERNITY"], color: '#9C27B0', art: 'mage_art' },
        NINJA: { name: "닌자", hp: 85, mp: 0, move: [4, 5], skills: ["STEALTH", "BACKSTAB"], color: '#333333', art: 'ninja_art' },
        BOWMASTER: { name: "보우마스터", hp: 90, mp: 0, move: [3, 4], skills: ["HURRICANE", "QUIVER_CARTRIDGE", "ARROW_PLATTER"], color: '#2E7D32', art: 'archer_art' },
        PATHFINDER: { name: "패스파인더", hp: 95, mp: 0, gauge: 0, move: [4, 5], skills: ["CARDINAL_DISCHARGE", "RELIC_EVOLUTION", "ANCIENT_ASTRA"], color: '#FF6F00', art: 'pathfinder_art' }
    }
};

const PIXEL_DATA = {
    knight: { colors: {'s':'#C0C0C0','f':'#FFCC99','r':'#FF0000','b':'#4169E1'}, data: ["  ssss  "," ssrrss "," ssssss ","  ffff  ","  bbbb  "," ggssgg ","  s  s  "] },
    mage: { colors: {'p':'#800080','f':'#FFCC99','y':'#FFD700'}, data: ["  pppp  "," pppppp ","  ffff  ","  pppp  "," yppppppy","  p  p  "] },
    ninja: { colors: {'k':'#1a1a1a','r':'#8b0000','s':'#fff'}, data: ["  kkkk  "," kkkkkk "," kskksk ","  ffff  ","  kkkk  "," krrkkr ","  k  k  "] },
    bowmaster: { colors: {'g':'#2E7D32','b':'#8B4513','f':'#FFCC99'}, data: ["  gggg  "," ggggb b","  ffff  ","  gggg  "," bgggggb","  g  g  "] },
    pathfinder: { colors: {'o':'#FF4500','b':'#444','f':'#FFCC99'}, data: ["  oooo  "," oooooo ","  ffff  ","  bbbb  "," obbbbo ","  b  b  "] }
};

// [Part 2] 전역 변수
let myRole = null, currentRoomId = null, isMyTurn = false, selectedCharKey = null, game = null;
let mapData = [], visualGrid = [];

// ★ 맵 크기 변경: 가로 11, 세로 7
const mapWidth = 11, mapHeight = 7, gridSize = 60;

let playerUnit, enemyUnit, gameState = 0, statusText, actionMenuGroup, skillDescText;
let reservedX, reservedY, selectedSkill, moveHighlights = [];
const STATE = { IDLE: 0, MOVE_SELECT: 1, ACTION_WAIT: 2, TARGET_SELECT: 3, BUSY: 4 };

// [Part 3] UI 및 매칭 로직 (이전과 동일, 픽셀 렌더러 포함)
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
        const artKey = k.toLowerCase().replace('master', 'master'); 
        const iconData = PIXEL_DATA[artKey] || PIXEL_DATA['knight'];
        const iconUrl = drawIcon(iconData.data, iconData.colors);
        const btn = document.createElement('div');
        btn.style.cssText = `width:100px; height:110px; background:${c.color}; border:2px solid #fff; cursor:pointer; color:white; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:5px; margin:5px;`;
        btn.innerHTML = `<img src="${iconUrl}" style="width:50px; height:50px; image-rendering:pixelated; margin-bottom:5px;"><b>${c.name}</b>`;
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
        if (d.hostReady && d.guestReady && d.status !== 'playing') {
            window.selectedChars = { host: d.hostChar, guest: d.guestChar };
            mapData = d.map;
            if (myRole === 'host') window.dbUpdate(window.dbRef(window.db, `rooms/${currentRoomId}`), { status: 'playing' });
            charSelectScreen.style.display = 'none'; document.getElementById('game-container').style.display = 'block';
            if (!game) game = new Phaser.Game(config);
        }
    });
}, 1500);

// [Part 4] 게임 로직 (이동 취소 추가)
class Unit {
    constructor(scene, data, x, y, isMe) {
        this.scene = scene; this.name = data.name; this.maxHp = data.hp; this.hp = data.hp;
        this.gauge = data.gauge !== undefined ? data.gauge : null;
        this.x = x; this.y = y; this.isMe = isMe;
        // ★ 이동 취소를 위한 이전 좌표 저장
        this.prevX = x; this.prevY = y; 
        
        this.skills = data.skills.map(k => ({...DB.SKILLS[k], id: k}));
        this.moveRange = data.move; this.cooldowns = {}; this.isReAction = false;
        const pos = gridToWorld(x, y);
        let artKey = (data.name === "보우마스터") ? "bowmaster" : data.name.toLowerCase();
        if(!PIXEL_DATA[artKey]) artKey = "knight";
        this.sprite = scene.add.sprite(pos.x, pos.y, artKey + '_art').setScale(1.5);
        if (!isMe) this.sprite.setTint(0xff8888);
        this.hpText = scene.add.text(pos.x, pos.y - 35, `${this.hp}`, { fontSize: '14px', fontStyle: 'bold', fill:'#fff' }).setOrigin(0.5);
    }
    updatePos(gx, gy) {
        this.x = gx; this.y = gy; const pos = gridToWorld(gx, gy);
        this.sprite.x = pos.x; this.sprite.y = pos.y; this.hpText.x = pos.x; this.hpText.y = pos.y - 35;
    }
    savePos() { this.prevX = this.x; this.prevY = this.y; }
    revertPos() { this.updatePos(this.prevX, this.prevY); }
    takeDamage(d) { this.hp -= d; this.hpText.setText(`${this.hp}`); return this.hp <= 0; }
}

const config = { type: Phaser.AUTO, parent: 'game-container', width: 800, height: 500, backgroundColor: '#1a1a1a', scene: { preload: preload, create: create } };

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
    // 맵 중앙 배치 계산
    const sX = (800 - (mapWidth * gridSize)) / 2; 
    const sY = (500 - (mapHeight * gridSize)) / 2;
    
    for (let x = 0; x < mapWidth; x++) {
        visualGrid[x] = [];
        for (let y = 0; y < mapHeight; y++) {
            const type = mapData[x] ? mapData[x][y].type : 'Grass';
            let color = type === 'Water' ? 0x1a4a7a : type === 'Mountain' ? 0x4a4a4a : type === 'Sand' ? 0x8a7a4a : 0x3d5e3a;
            const tile = this.add.rectangle(sX + x*gridSize + 30, sY + y*gridSize + 30, 56, 56, color).setStrokeStyle(2, 0x000, 0.5).setInteractive();
            visualGrid[x][y] = tile; tile.on('pointerdown', () => onTileClick(x, y));
        }
    }
    const myK = myRole === 'host' ? window.selectedChars.host : window.selectedChars.guest;
    const enK = myRole === 'host' ? window.selectedChars.guest : window.selectedChars.host;
    
    // ★ 시작 위치 변경: 가로(11)의 중앙은 5. 
    // Host: 아래쪽 중앙 (5, 6), Guest: 위쪽 중앙 (5, 0)
    const startX = Math.floor(mapWidth / 2);
    const hostY = mapHeight - 1;
    
    if (myRole === 'host') {
        playerUnit = new Unit(this, DB.CHARACTERS[myK], startX, hostY, true);
        enemyUnit = new Unit(this, DB.CHARACTERS[enK], startX, 0, false);
    } else {
        playerUnit = new Unit(this, DB.CHARACTERS[myK], startX, 0, true);
        enemyUnit = new Unit(this, DB.CHARACTERS[enK], startX, hostY, false);
    }

    statusText = this.add.text(10, 10, "대기 중...", { fontSize: '20px' });
    skillDescText = this.add.text(400, 460, "", { fontSize: '14px', backgroundColor: '#000c', padding: 8 }).setOrigin(0.5).setVisible(false);
    createActionMenu(this); setupSync();
}

function onTileClick(x, y) {
    if (!isMyTurn || gameState === STATE.BUSY) return;
    
    if (gameState === STATE.IDLE && x === playerUnit.x && y === playerUnit.y) {
        // 이동 시작 시 현재 위치 저장
        playerUnit.savePos();
        clearHighlights(); showMoveRange(x, y, Phaser.Math.Between(playerUnit.moveRange[0], playerUnit.moveRange[1]));
        gameState = STATE.MOVE_SELECT;
    } else if (gameState === STATE.MOVE_SELECT && isHighlighted(x, y)) {
        reservedX = x; reservedY = y; clearHighlights();
        const p = gridToWorld(x, y); 
        // 이동한 척 미리 보여주기
        playerUnit.updatePos(reservedX, reservedY);
        moveHighlights.push({x, y, rect: playerUnit.scene.add.circle(p.x, p.y, 8, 0xfff)});
        gameState = STATE.ACTION_WAIT; openActionMenu();
    } else if (gameState === STATE.TARGET_SELECT && isHighlighted(x, y)) {
        if (x === enemyUnit.x && y === enemyUnit.y) executeAction(selectedSkill, enemyUnit);
        else if (selectedSkill.range === 0 && x === reservedX && y === reservedY) executeAction(selectedSkill, playerUnit);
    }
}

function executeAction(s, t) {
    gameState = STATE.BUSY; closeActionMenu(); clearHighlights();
    
    // 이동 취소 버튼이 아닐 경우 위치 확정 (이미 updatePos는 되어있음)
    
    let totalDamage = s.power || 0;
    if (s.hits) totalDamage *= s.hits; // 보우마스터 연사

    // 패스파인더 게이지
    if (selectedCharKey === 'PATHFINDER') {
        if (s.addGauge) playerUnit.gauge = Math.min(100, (playerUnit.gauge||0) + s.addGauge);
        if (s.reqGauge) {
            if ((playerUnit.gauge||0) < s.reqGauge) { 
                alert("게이지 부족!"); 
                playerUnit.revertPos(); // 실패시 복귀
                gameState = STATE.IDLE; return; 
            }
            playerUnit.gauge = 0;
        }
    }

    if (s.id !== 'WAIT') {
        if (s.cooldown > 0) playerUnit.cooldowns[s.id] = s.cooldown;
        if (totalDamage > 0 && t) t.takeDamage(totalDamage);
        
        // 닌자 배후노리기 (텔레포트)
        if (s.teleportBehind && t) {
             const behindY = t.y + (t.y > playerUnit.y ? 1 : -1);
             if (behindY >= 0 && behindY < mapHeight) playerUnit.updatePos(t.x, behindY);
        }

        if (s.triggerReAction && !playerUnit.isReAction) {
            playerUnit.isReAction = true; gameState = STATE.IDLE; updateSync(false); return;
        }
    }
    playerUnit.isReAction = false; updateSync(true);
}

// ★ 이동 취소 기능 구현
function cancelMove() {
    playerUnit.revertPos(); // 원래 위치로 복귀
    gameState = STATE.IDLE;
    closeActionMenu();
    clearHighlights();
}

function updateSync(end) {
    const updates = { [`${myRole}Unit`]: { x: playerUnit.x, y: playerUnit.y, hp: playerUnit.hp, gauge: playerUnit.gauge } };
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
        if (enD) {
            enemyUnit.updatePos(enD.x, enD.y);
            enemyUnit.hp = enD.hp;
            enemyUnit.hpText.setText(`${enD.hp}`);
        }
    });
}

function gridToWorld(x, y) { 
    const sX = (800 - (mapWidth * gridSize)) / 2; 
    const sY = (500 - (mapHeight * gridSize)) / 2;
    return { x: sX + x*gridSize + 30, y: sY + y*gridSize + 30 }; 
}
function clearHighlights() { moveHighlights.forEach(h => h.rect.destroy()); moveHighlights = []; }
function isHighlighted(x, y) { return moveHighlights.some(h => h.x === x && h.y === y); }
function createActionMenu(s) { actionMenuGroup = s.add.group(); }

function openActionMenu() {
    actionMenuGroup.clear(true, true); let y = 100;
    
    // 스킬 버튼들
    playerUnit.skills.forEach(skill => {
        const cd = playerUnit.cooldowns[skill.id] || 0;
        const isDisabled = cd > 0 || (playerUnit.isReAction && skill.isUltimate);
        const btn = playerUnit.scene.add.text(700, y, skill.name + (cd>0 ? `(${cd})` : ""), {
            backgroundColor: isDisabled ? '#444' : '#900', padding: 8, fixedWidth: 120, align: 'center'
        }).setInteractive();
        
        btn.on('pointerover', () => skillDescText.setText(`[${skill.name}] ${skill.desc}`).setVisible(true));
        btn.on('pointerout', () => skillDescText.setVisible(false));
        
        if (!isDisabled) {
            btn.on('pointerdown', () => {
                skillDescText.setVisible(false); selectedSkill = skill;
                if (skill.range > 0) { 
                    gameState = STATE.TARGET_SELECT; clearHighlights(); showTargetRange(reservedX, reservedY, skill.range); 
                } else executeAction(skill, playerUnit);
            });
        }
        actionMenuGroup.add(btn); y += 45;
    });

    // 대기 버튼
    const waitBtn = playerUnit.scene.add.text(700, y, "대기", { backgroundColor: '#005', padding: 8, fixedWidth: 120, align: 'center' }).setInteractive();
    waitBtn.on('pointerdown', () => executeAction({id: 'WAIT'}, null));
    actionMenuGroup.add(waitBtn); y += 45;

    // ★ 이동 취소 버튼 추가
    const cancelBtn = playerUnit.scene.add.text(700, y, "이동 취소", { backgroundColor: '#555', padding: 8, fixedWidth: 120, align: 'center' }).setInteractive();
    cancelBtn.on('pointerdown', () => cancelMove());
    actionMenuGroup.add(cancelBtn);
}

function showTargetRange(sx, sy, r) {
    for (let x = 0; x < mapWidth; x++) for (let y = 0; y < mapHeight; y++) {
        if (Math.abs(x - sx) + Math.abs(y - sy) <= r) {
            const p = gridToWorld(x, y); moveHighlights.push({x, y, rect: playerUnit.scene.add.rectangle(p.x, p.y, 50, 50, 0xf00, 0.4)});
        }
    }
}

function showMoveRange(sx, sy, r) {
    for (let x = 0; x < mapWidth; x++) for (let y = 0; y < mapHeight; y++) {
        const d = Math.abs(x - sx) + Math.abs(y - sy);
        const t = mapData[x] ? mapData[x][y].type : 'Grass';
        if ((t === 'Mountain' || t === 'Water') || d === 0 || d > r) continue;
        const p = gridToWorld(x, y); moveHighlights.push({x, y, rect: playerUnit.scene.add.rectangle(p.x, p.y, 50, 50, 0x00f, 0.4)});
    }
}

function closeActionMenu() { actionMenuGroup.clear(true, true); if(skillDescText) skillDescText.setVisible(false); }
