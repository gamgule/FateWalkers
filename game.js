// ==========================================
// [Part 0] 맵 생성 및 클래스 중복 방지
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
                    const isCenter = (x >= 2 && x <= 4 && y >= 3 && y <= 5);
                    const rand = Math.random();
                    if (!isCenter) {
                        if (rand < 0.15) type = 'Water';
                        else if (rand < 0.25) type = 'Mountain';
                        else if (rand < 0.35) type = 'Sand';
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
// [Part 1] 전역 변수 및 데이터베이스 (채팅 내역 복구)
// ==========================================
let myRole = null; let currentRoomId = null; let isMyTurn = false;
let selectedCharKey = null; let game = null;

const lobbyScreen = document.getElementById('lobby-screen');
const charSelectScreen = document.getElementById('char-select-screen');
const gameContainer = document.getElementById('game-container');
const infoBox = document.getElementById('char-info-box');

const DB = {
    SKILLS: {
        // [기사]
        SLASH: { name: "베기", power: 25, range: 3, cooldown: 0, cost: 0, desc: "기본 공격" },
        UPPER_SLASH: { name: "상단 베기", power: 50, range: 2, cooldown: 3, cost: 0, desc: "강력한 일격" },
        GUARD: { name: "가드", type: "buff", cooldown: 2, reduction: 0.3, cost: 0, desc: "방어 태세 (30% 경감)" },
        SHIELD_THROW: { name: "방패 던지기", power: 10, range: 4, triggerReAction: true, maxUse: 1, isUltimate: true, cost: 0, desc: "[궁극기] 재행동" },
        
        // [마법사]
        MAGIC_MISSILE: { name: "매직미사일", power: 20, range: 5, cost: 10, cooldown: 0, desc: "MP 10 소모" },
        FIREBALL: { name: "파이어볼", power: 30, range: 5, cost: 20, cooldown: 2, desc: "화염 공격" },
        ICE_SPEAR: { name: "아이스 스피어", power: 35, range: 4, cost: 20, cooldown: 2, desc: "얼음 창" },
        INFERNITY: { name: "인페르니티", power: 110, range: 8, cost: 100, cooldown: 5, isUltimate: true, disablePassive: 1, desc: "[궁극기] MP 100 소모" },
        
        // [닌자]
        DIAGONAL_SLASH: { name: "사선베기", power: 25, range: 2, cooldown: 0, cost: 0, extraMove: 3, desc: "공격 후 3칸 이동" },
        STEALTH: { name: "은신", type: "buff", range: 0, cooldown: 4, cost: 0, triggerReAction: true, effect: "stealth", desc: "은신 & 재행동" },
        KUNAI_THROW: { name: "쿠나이", power: 25, range: 4, cooldown: 0, cost: 0, extraMove: 3, desc: "원거리 후 3칸 이동" },
        BACKSTAB: { name: "배후노리기", power: 60, range: 6, cooldown: 0, cost: 0, isUltimate: true, reqStealth: true, teleportBehind: true, extraMove: 1, desc: "[궁극기] 은신 필요, 적 뒤로 이동" },

        // [보우 마스터] (복구 완료)
        SNIPE: { name: "저격", power: 20, range: 6, minRange: 4, cooldown: 0, cost: 0, desc: "장거리 사격 (4~6칸)" },
        AIM: { name: "조준", type: "buff", range: 0, cooldown: 0, cost: 0, triggerReAction: true, effect: "aim", desc: "다음 저격 강화 & 재행동" },
        BACKSTEP: { name: "백스텝", power: 0, range: 0, cooldown: 2, cost: 0, triggerReAction: true, effect: "backstep", desc: "뒤로 2칸 이동 & 재행동" },
        HEADSHOT: { name: "헤드샷", power: 70, range: 7, minRange: 5, cooldown: 6, cost: 0, isUltimate: true, chargeTurn: 1, desc: "[궁극기] 1턴 차징 후 발사" },

        // [패스파인더] (복구 완료)
        DAGGER_STAB: { name: "단검 찌르기", power: 20, range: 2, cooldown: 0, cost: 0, desc: "기본 공격" },
        PATH_DETECT: { name: "경로 탐지", type: "buff", range: 0, cooldown: 2, cost: 0, effect: "detect", desc: "공격력 증가 버프" },
        PATH_SET: { name: "경로 설정", type: "buff", range: 0, cooldown: 4, cost: 0, triggerReAction: true, effect: "pathset", desc: "이동력 대폭 증가 & 재행동" },
        CROSSBOW_SURGE: { name: "석궁 쇄도", power: 10, range: 5, cooldown: 4, cost: 0, isUltimate: true, reqAmbush: true, desc: "[궁극기] 기습(8칸 이동) 시 사용 가능" }
    },
    PASSIVES: {
        KNIGHT_SHIELD: { name: "기사의 방패", rate: 0.3, reduction: 0.2, maxCount: 1, type: "defense" },
        MANA_MASTER: { name: "마나의 주인", type: "regen", amount: 30, desc: "매 턴 MP 30 회복" },
        STEALTH_ART: { name: "은신술", type: "state", desc: "은신 시 이동력 증가" },
        // [보우 마스터 패시브]
        CRITICAL_HIT: { name: "크리티컬", type: "attack", rate: 0.05, multiplier: 1.5, desc: "5% 확률로 1.5배 데미지" },
        // [패스파인더 패시브]
        PATHFINDER_KIT: { name: "패스파인더", type: "hybrid", desc: "이동 거리 비례 보너스 (8칸이상 2배)" }
    },
    CHARACTERS: {
        KNIGHT: { name: "기사", hp: 120, mp: 0, move: [2, 3], skills: ["SLASH", "UPPER_SLASH", "GUARD", "SHIELD_THROW"], passive: "KNIGHT_SHIELD", color: '#C0C0C0' },
        MAGE: { name: "마법사", hp: 100, mp: 100, move: [2, 4], skills: ["MAGIC_MISSILE", "FIREBALL", "ICE_SPEAR", "INFERNITY"], passive: "MANA_MASTER", color: '#9C27B0' },
        NINJA: { name: "닌자", hp: 85, mp: 0, move: [4, 5], skills: ["DIAGONAL_SLASH", "STEALTH", "KUNAI_THROW", "BACKSTAB"], passive: "STEALTH_ART", color: '#333333' },
        // [보우 마스터]
        BOW_MASTER: { name: "보우 마스터", hp: 100, mp: 0, move: [3, 4], skills: ["SNIPE", "AIM", "BACKSTEP", "HEADSHOT"], passive: "CRITICAL_HIT", color: '#228B22' },
        // [패스파인더]
        PATHFINDER: { name: "패스파인더", hp: 70, mp: 0, move: [4, 7], skills: ["DAGGER_STAB", "PATH_DETECT", "PATH_SET", "CROSSBOW_SURGE"], passive: "PATHFINDER_KIT", color: '#FF4500' }
    }
};

// [Part 2] 맵 생성 및 그래픽 리소스
const PIXEL_DATA = {
    knight: { colors: {'s':'#C0C0C0','f':'#FFCC99','r':'#FF0000','b':'#4169E1','g':'#404040'}, data: [" ssss "," ssrrss "," ssssss ","  ffff  ","  bbbb  "," ggssgg ","  s  s  "] },
    mage: { colors: {'p':'#800080','f':'#FFCC99','y':'#FFD700'}, data: ["  pppp  "," pppppp ","  ffff  ","  pppp  "," yppppppy","  p  p  "] },
    ninja: { colors: {'k':'#1a1a1a','r':'#8b0000','s':'#fff'}, data: ["  kkkk  "," kkkkkk "," kskksk ","  ffff  ","  kkkk  "," krrkkr ","  k  k  "] },
    bow_master: { colors: {'g':'#2E7D32','b':'#8B4513','f':'#FFCC99'}, data: ["  gggg  "," ggggb b","  ffff  ","  gggg  "," bgggggb","  g  g  "] },
    pathfinder: { colors: {'o':'#FF4500','b':'#444','f':'#FFCC99'}, data: ["  oooo  "," oooooo ","  ffff  ","  bbbb  "," obbbbo ","  b  b  "] }
};

function drawIcon(pixels, colors) {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const size = 32 / pixels.length;
    for(let y=0; y<pixels.length; y++) {
        for(let x=0; x<pixels[y].length; x++) {
            if(pixels[y][x] !== ' ') { ctx.fillStyle = colors[pixels[y][x]]; ctx.fillRect(x*size, y*size, size, size); }
        }
    }
    return canvas.toDataURL();
}

// [Part 3] 매칭 로직 (이전 코드 유지)
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
    const hostRoll = Math.floor(Math.random() * 100);
    const guestRoll = Math.floor(Math.random() * 100);
    const firstTurn = hostRoll >= guestRoll ? 'host' : 'guest';
    window.dbSet(ref, { status: 'waiting', turn: firstTurn, hostRoll: hostRoll, guestRoll: guestRoll, hostReady: false, guestReady: false });
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
        const artKey = k.toLowerCase();
        const iconData = PIXEL_DATA[artKey] || PIXEL_DATA['knight'];
        const iconUrl = drawIcon(iconData.data, iconData.colors);
        const btn = document.createElement('div');
        btn.style.cssText = `width:100px; height:110px; background:${c.color}; border:2px solid #fff; cursor:pointer; color:white; display:flex; flex-direction:column; align-items:center; justify-content:center;`;
        btn.innerHTML = `<img src="${iconUrl}" style="width:50px; height:50px; image-rendering:pixelated; margin-bottom:5px;"><b>${c.name}</b>`;
        btn.onclick = () => {
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

// 게임 시작 감시
setInterval(() => {
    if (!currentRoomId) return;
    window.dbGet(window.dbRef(window.db, `rooms/${currentRoomId}`)).then((snap) => {
        const d = snap.val(); if (!d) return;
        if (d.hostReady && d.guestReady && d.status !== 'playing') {
            window.selectedChars = { host: d.hostChar, guest: d.guestChar };
            if (myRole === 'host') {
                const mapGen = new MapGenerator(7, 9);
                window.dbUpdate(window.dbRef(window.db, `rooms/${currentRoomId}`), { status: 'playing', map: mapGen.generate() });
            }
        }
        if (d.status === 'playing') {
            mapData = d.map || [];
            charSelectScreen.style.display = 'none'; gameContainer.style.display = 'block';
            if (!game) game = new Phaser.Game(config);
        }
    });
}, 1500);

// ==========================================
// [Part 4] 인게임 로직 (차징, 백스텝, 패시브 구현)
// ==========================================
let mapData = [], visualGrid = [];
const mapWidth = 7, mapHeight = 9, gridSize = 60;
let playerUnit, enemyUnit, gameState = 0;
let statusText, actionMenuGroup, skillDescText;
let reservedX, reservedY, selectedSkill;
let moveHighlights = [];
const STATE = { IDLE: 0, MOVE_SELECT: 1, ACTION_WAIT: 2, TARGET_SELECT: 3, BUSY: 4, CHARGING: 5 };

class Unit {
    constructor(scene, data, x, y, isMe) {
        this.scene = scene; this.name = data.name; this.maxHp = data.hp; this.hp = data.hp;
        this.maxMp = data.mp || 0; this.mp = 0;
        this.x = x; this.y = y; this.isMe = isMe;
        this.skills = data.skills.map(k => ({...DB.SKILLS[k], id: k}));
        this.passive = data.passive ? DB.PASSIVES[data.passive] : null;
        this.moveRange = data.move; this.cooldowns = {}; this.isReAction = false;
        
        // 특수 상태 변수
        this.isCharging = false; // 보우마스터 차징
        this.movedDistance = 0;  // 패스파인더 이동 거리
        this.aimActive = false;  // 보우마스터 조준

        const pos = gridToWorld(x, y);
        let artKey = data.name === "보우 마스터" ? "bow_master" : data.name.toLowerCase();
        if(!PIXEL_DATA[artKey]) artKey = "knight"; // fallback

        this.sprite = scene.add.sprite(pos.x, pos.y, artKey + '_art').setScale(1.5);
        if (!isMe) this.sprite.setTint(0xff8888);
        this.hpText = scene.add.text(pos.x, pos.y - 35, `${this.hp}`, { fontSize: '14px', fontStyle: 'bold' }).setOrigin(0.5);
    }
    updatePos(gx, gy) {
        // 이동 거리 계산 (패스파인더용)
        const dist = Math.abs(this.x - gx) + Math.abs(this.y - gy);
        this.movedDistance += dist;
        this.x = gx; this.y = gy;
        const pos = gridToWorld(gx, gy);
        this.sprite.x = pos.x; this.sprite.y = pos.y;
        this.hpText.x = pos.x; this.hpText.y = pos.y - 35;
    }
    takeDamage(d) { this.hp -= d; this.hpText.setText(`${this.hp}`); return this.hp <= 0; }
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
        for(let y=0; y<pixels.length; y++) for(let x=0; x<pixels[y].length; x++) {
            if(pixels[y][x] !== ' ') { ctx.fillStyle = colors[pixels[y][x]]; ctx.fillRect(x*size, y*size, size, size); }
        }
        canvas.refresh();
    };
    Object.keys(PIXEL_DATA).forEach(k => createArt(k+'_art', PIXEL_DATA[k].colors, PIXEL_DATA[k].data));
}

function create() {
    const sX = (800 - (7 * 60)) / 2; const sY = (600 - (9 * 60)) / 2;
    for (let x = 0; x < 7; x++) {
        visualGrid[x] = [];
        for (let y = 0; y < 9; y++) {
            const type = mapData[x] ? mapData[x][y].type : 'Grass';
            let color = type === 'Water' ? 0x1a4a7a : type === 'Mountain' ? 0x4a4a4a : type === 'Sand' ? 0x8a7a4a : 0x3d5e3a;
            const tile = this.add.rectangle(sX + x*60 + 30, sY + y*60 + 30, 56, 56, color).setStrokeStyle(2, 0x000, 0.5).setInteractive();
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
    if (!isMyTurn || gameState === STATE.BUSY || playerUnit.isCharging) return;
    
    if (gameState === STATE.IDLE && x === playerUnit.x && y === playerUnit.y) {
        clearHighlights(); showMoveRange(x, y, Phaser.Math.Between(playerUnit.moveRange[0], playerUnit.moveRange[1]));
        gameState = STATE.MOVE_SELECT;
    } else if (gameState === STATE.MOVE_SELECT && isHighlighted(x, y)) {
        reservedX = x; reservedY = y; clearHighlights();
        const p = gridToWorld(x, y); moveHighlights.push({x, y, rect: playerUnit.scene.add.circle(p.x, p.y, 8, 0xfff)});
        gameState = STATE.ACTION_WAIT; openActionMenu();
    } else if (gameState === STATE.TARGET_SELECT && isHighlighted(x, y)) {
        if (selectedSkill.id === 'BACKSTEP') { // 백스텝은 땅을 클릭
             executeAction(selectedSkill, null);
        } else if (x === enemyUnit.x && y === enemyUnit.y) {
             executeAction(selectedSkill, enemyUnit);
        } else if (selectedSkill.type === 'buff' && x === reservedX && y === reservedY) {
             executeAction(selectedSkill, playerUnit);
        }
    }
}

function executeAction(s, t) {
    gameState = STATE.BUSY; closeActionMenu(); clearHighlights();
    
    // 1. 이동 처리 (백스텝은 로직이 다름)
    if (s.effect === 'backstep') {
        // 현재 위치 기준 뒤쪽(적 반대)으로 2칸
        const dy = (playerUnit.y > enemyUnit.y) ? 1 : -1;
        let newY = playerUnit.y + (dy * 2);
        newY = Phaser.Math.Clamp(newY, 0, 8);
        playerUnit.updatePos(playerUnit.x, newY);
    } else {
        playerUnit.updatePos(reservedX, reservedY);
    }

    // 2. 스킬 효과
    if (s.id !== 'WAIT') {
        // 차징 스킬 (헤드샷)
        if (s.chargeTurn) {
            playerUnit.isCharging = true;
            statusText.setText("차징 시작! 다음 턴에 발사합니다.");
            updateSync(true); return;
        }

        if (s.cooldown > 0) playerUnit.cooldowns[s.id] = s.cooldown;
        
        let damage = s.power || 0;
        
        // 보우마스터 패시브 (크리티컬)
        if (playerUnit.passive && playerUnit.passive.name === '크리티컬') {
            if (Math.random() < 0.05) damage *= 1.5;
        }
        // 패스파인더 패시브 (기습: 8칸 이동시 2배)
        if (playerUnit.passive && playerUnit.passive.name === '패스파인더') {
            if (playerUnit.movedDistance >= 8) damage *= 2;
        }

        if (damage > 0 && t) t.takeDamage(damage);

        // 재행동 체크
        if (s.triggerReAction && !playerUnit.isReAction) {
            playerUnit.isReAction = true;
            gameState = STATE.IDLE; updateSync(false); return;
        }
    }
    
    playerUnit.isReAction = false;
    playerUnit.movedDistance = 0; // 턴 종료 시 이동거리 초기화
    updateSync(true);
}

// ... (이하 setupSync, showMoveRange, gridToWorld 등 유틸 함수들은 이전 코드와 동일하여 생략. 위에서 잘린 부분 없이 그대로 사용하시면 됩니다)
function updateSync(end) {
    const updates = { [`${myRole}Unit`]: { x: playerUnit.x, y: playerUnit.y, hp: playerUnit.hp } };
    if (end) updates.turn = myRole === 'host' ? 'guest' : 'host';
    window.dbUpdate(window.dbRef(window.db, `rooms/${currentRoomId}`), updates);
}

function setupSync() {
    window.dbOnValue(window.dbRef(window.db, `rooms/${currentRoomId}`), (snap) => {
        const d = snap.val(); if (!d) return;
        
        // 턴 시작 처리
        if (d.turn === myRole && !isMyTurn) {
            isMyTurn = true; gameState = STATE.IDLE; statusText.setText("내 턴");
            
            // 차징 중이었다면 발사
            if (playerUnit.isCharging) {
                playerUnit.isCharging = false;
                // 헤드샷 자동 발사 로직
                enemyUnit.takeDamage(70); 
                statusText.setText("헤드샷 발사!");
                setTimeout(() => updateSync(true), 1000);
                return;
            }

            // 쿨타임 감소
            for (let k in playerUnit.cooldowns) if (playerUnit.cooldowns[k] > 0) playerUnit.cooldowns[k]--;
            // 패스파인더 패시브 초기화
            playerUnit.movedDistance = 0;

        } else if (d.turn !== myRole) { 
            isMyTurn = false; statusText.setText("상대 턴"); 
        }
        
        const enD = d[myRole === 'host' ? 'guestUnit' : 'hostUnit'];
        if (enD) {
            enemyUnit.updatePos(enD.x, enD.y);
            enemyUnit.hp = enD.hp;
            enemyUnit.hpText.setText(`${enD.hp}`);
        }
    });
}

function gridToWorld(x, y) { return { x: ((800 - (7 * 60)) / 2) + x*60 + 30, y: ((600 - (9 * 60)) / 2) + y*60 + 30 }; }
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
            if (s.id === 'BACKSTEP') { // 백스텝은 타겟팅 없이 즉시 바닥 클릭 유도
                 gameState = STATE.TARGET_SELECT; clearHighlights();
                 // 자기 주변 표시
                 const pos = gridToWorld(reservedX, reservedY);
                 moveHighlights.push({x: reservedX, y: reservedY, rect: playerUnit.scene.add.rectangle(pos.x, pos.y, 50, 50, 0x00ff00, 0.4)});
            }
            else if (s.range > 0) { 
                gameState = STATE.TARGET_SELECT; clearHighlights(); showTargetRange(reservedX, reservedY, s.range, s.minRange || 0); 
            }
            else executeAction(s, playerUnit);
        });
        actionMenuGroup.add(btn); y += 50;
    });
    const wBtn = playerUnit.scene.add.text(700, y, "대기", { backgroundColor: '#005', padding: 8, fixedWidth: 120, align: 'center' }).setInteractive();
    wBtn.on('pointerdown', () => executeAction({id: 'WAIT'}, null)); actionMenuGroup.add(wBtn);
}

function showTargetRange(sx, sy, r, minR) {
    for (let x = 0; x < mapWidth; x++) for (let y = 0; y < mapHeight; y++) {
        const d = Math.abs(x - sx) + Math.abs(y - sy);
        if (d <= r && d >= minR) {
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
