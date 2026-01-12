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
                // 기본은 풀(Grass)
                let type = { name: 'Grass', cost: 1 };
                
                // 15% 확률로 산(Mountain - 이동불가/장애물)
                if (Math.random() < 0.15) {
                    type = { name: 'Mountain', cost: 99 };
                }
                // 10% 확률로 물(Water - 이동불가)
                else if (Math.random() < 0.10) {
                    type = { name: 'Water', cost: 99 };
                }
                
                // 시작 지점(위/아래)은 무조건 평지여야 함
                if ((y < 2) || (y > this.height - 3)) {
                    type = { name: 'Grass', cost: 1 };
                }

                map[x][y] = { finalType: type };
            }
        }
        return map;
    }
}