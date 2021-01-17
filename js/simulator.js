// https://closure-compiler.appspot.com/home
/*==================================
		定数
==================================*/
// 入力され得る搭載数の最大値
const MAX_SLOT = 99;

// 画像置き場 プリロード用
const IMAGES = {};

/*==================================
		グローバル変数
==================================*/

// 自軍st1撃墜テーブル
let SHOOT_DOWN_TABLE;

// 敵st1撃墜テーブル
let SHOOT_DOWN_TABLE_ENEMY;

// 制空状態テーブル
let AIR_STATUS_TABLE;

// 各種モーダルの値返却先
let $target = null;

// 基本の艦載機データ群(基地用ソート済み)
let basicSortedPlanes = [];

// ドラッグ要素範囲外フラグ
let isOut = false;

// 防空モードフラグ
let isDefMode = false;

// 交戦回数
let battleCount = 1;

// 結果表示戦闘
let displayBattle = 1;

// イベント発生用タイマー
let timer = false;

// 機体プリセット
let planePreset = null;

// 熟練度 >> 選択時、内部熟練度を 120 として計算するもの
let initialProf120Plane = [];

// controlキー状態
let isCtrlPress = false;

// メモリ解放用タイマー
let releaseTimer = null;

// 配備機体
let usedPlane = [];

// 編成済み艦娘
let usedShip = [];

// Chart描画用データ
let chartInstance = null;
let subChartInstance = null;

// 計算結果格納オブジェクト
let resultData = {
	enemyAirPowers: [],
	enemyAirPowerResults: [],
	enemySlots: [],
	enemySlotAllDead: [],
	landBaseAirPowers: [],
	landBaseAirStatus: [],
	fleetAirPower: 0,
	fleetAirStatus: [],
	fleetSlots: [],
	defenseAirPower: 0,
	usedSteels: 0
};

let errorInfo = null;

// 入力加重対空値
let inputAntiAirWeights = [];
// 味方艦隊用Stage2テーブル
let fleetStage2Table = [];

// 海域情報
let ENEMY_PATTERN = [];

/** @type {InputData} */
let inputItems = null;

class InputData {
	constructor() {
		/** @type {LandBaseAll} */
		this.landBase = null;
		/** @type {Fleet} */
		this.fleet = null;
		/** @type {BattleData} */
		this.battleInfo = null;
	}
}

class Fleet {
	constructor() {
		/** @type {Array<Ship>} */
		this.ships = [];
		/** @type {number} */
		this.airPower = 0;
		/** @type {number} */
		this.fullAirPower = 0;
		/** @type {number} */
		this.unionAirPower = 0;
		/** @type {number} */
		this.fullUnionAirPower = 0;
		/** @type {number} */
		this.escortAirPower = 0;
		/** @type {number} */
		this.fullEscortAirPower = 0;
		/** @type {boolean} */
		this.hasJet = false;
	}

	/**
	 * 制空値の更新
	 * @memberof Fleet
	 */
	updateAirPower() {
		this.unionAirPower = 0;
		this.airPower = 0;
		this.escortAirPower = 0;

		for (const ship of this.ships) {
			// 全体
			this.unionAirPower += ship.airPower;
			if (!ship.isEscort) {
				this.airPower += ship.airPower;
			}
			else {
				this.escortAirPower += ship.airPower;
			}
		}
	}

	/**
	 * 補給状態の制空値を現在の値で置き換える
	 * @memberof Fleet
	 */
	initFullAirPower() {
		this.fullAirPower = this.airPower;
		this.fullEscortAirPower = this.escortAirPower;
		this.fullUnionAirPower = this.unionAirPower;
	}

	/**
	 * この艦隊の夜偵発動率
	 * @memberof Ship
	 */
	nightContactRate(isUnion = false) {
		let sum = 1;
		for (const ship of this.ships) {
			if (!isUnion || (isUnion && ship.isEscort)) {
				for (const plane of ship.planes.filter(v => v.id === 102 && v.slot > 0)) {
					// 連続で成功しない確率をとっていく
					sum *= (1 - Math.floor(Math.sqrt(ship.level) * Math.sqrt(plane.scout)) / 25);
				}
			}
		}
		// 失敗しない確率
		return 1 - sum;
	}
}

class Ship {
	/**
	 *Creates an instance of Ship.
	 * @param {number} fleetNo
	 * @memberof Ship
	 */
	constructor(fleetNo) {
		/** @type {number} */
		this.id = 0;
		/** @type {number} */
		this.fleetNo = fleetNo;
		/** @type {Array<ShipPlane>} */
		this.planes = [];
		/** @type {boolean} */
		this.isEscort = false;
		/** @type {number} */
		this.airPower = 0;
		/** @type {number} */
		this.fullAirPower = 0;
		/** @type {number} */
		this.level = 99;
		/** @type {boolean} */
		this.taichi = true;
	}

	/**
	 * この艦娘の制空値を更新する
	 * @memberof Ship
	 */
	updateAirPower() {
		let sum = 0;
		for (const plane of this.planes) {
			sum += plane.airPower;
		}
		this.airPower = sum;
	}

	/**
	 * 補給状態の制空値を現在の値で置き換える
	 * @memberof Fleet
	 */
	initFullAirPower() {
		this.fullAirPower = this.airPower;
	}
}

/**
 * 基地航空隊全体
 * @class LandBaseAll
 */
class LandBaseAll {
	constructor() {
		/** @type {Array<LandBase} */
		this.landBases = [];
		/** @type {number} */
		this.defenseAirPower = 0;
		/** @type {number} */
		this.defense2AirPower = 0;
		/** @type {number} */
		this.rocketBonus = 0;
	}

	/**
	 * 防空時制空値を取得
	 * ロケ戦も考慮
	 * @memberof LandBaseAll
	 */
	updateDefenseAirPower() {
		// ロケット戦闘機の数を取得
		let rocketCount = 0;
		let sumAp = 0;
		for (const v of this.landBases) {
			// 防空札になってないのはノーカン
			if (v.mode !== 0) continue;
			sumAp += v.defenseAirPower;
			for (const plane of v.planes) if (ROCKETS.includes(plane.id)) rocketCount++;
		}

		// 対重爆時補正 ロケット0機:0.5、1機:0.8、2機:1.1、3機異常:1.2
		this.rocketBonus = rocketCount === 0 ? 0.5 : rocketCount === 1 ? 0.8 : rocketCount === 2 ? 1.1 : 1.2;
		this.defenseAirPower = sumAp;
		this.defense2AirPower = Math.floor(this.rocketBonus * sumAp);
	}
}

/**
 * 基地航空隊部隊別
 * @class LandBase
 */
class LandBase {
	constructor(baseNo, mode) {
		/** @type {number} */
		this.baseNo = baseNo;
		/** @type {Array<LandBasePlane>} */
		this.planes = [];
		/** @type {number} */
		this.mode = mode;
		/** @type {Array<number>} */
		this.target = [-1, -1];
		/** @type {number} */
		this.airPower = 0;
		/** @type {number} */
		this.fullAirPower = 0;
		/** @type {number} */
		this.defenseAirPower = 0;
		/** @type {number} */
		this.reconCorr = 0;
		/** @type {number} */
		this.defenseCorr = 1.0;
		/** @type {Array<AirStatusResult>} */
		this.results = [];
		/** @type {boolean} */
		this.hasJet = false;

		for (let index = 0; index < battleCount; index++) {
			this.results.push(new AirStatusResult());
		}
	}

	/**
	 * この航空隊の制空値、補正値を設定する
	 * @memberof LandBase
	 */
	updateAirPower() {
		let sum = 0;
		for (const plane of this.planes) {
			sum += plane.airPower;
		}

		const baseAP = sum;
		let resultAP = baseAP;

		if (this.reconCorr < 1.0) {
			// 最低保証
			this.reconCorr = 1.0;

			// 偵察機たち
			const planes = this.planes.filter(v => v.isRecon);

			// 補正後の値が上回っているものに更新
			for (const plane of planes) {
				const corr = getReconnaissancesAdjust(plane, false);
				const newAp = baseAP * corr;
				if (newAp > resultAP) {
					resultAP = newAp;
					this.reconCorr = corr;
				}
			}
		}
		else {
			// 補正値が設定されていたらそれを使う
			resultAP = baseAP * this.reconCorr;
		}

		this.airPower = Math.floor(resultAP);
	}

	/**
	 * この航空隊の防空時の制空値、補正値を設定する
	 * @memberof LandBase
	 */
	updateDefenseAirPower() {
		const baseAP = getArraySum(this.planes.map(v => v.defenseAirPower));
		let resultAP = baseAP;
		// 偵察機たち
		const planes = this.planes.filter(v => v.isRecon);

		// 補正後の値が上回っているものに更新
		for (const plane of planes) {
			const corr = getReconnaissancesAdjust(plane, true);
			const newAp = baseAP * corr;
			if (newAp > resultAP) {
				resultAP = newAp;
				this.reconCorr = corr;
			}
		}

		this.defenseAirPower = Math.floor(resultAP);
	}

	/**
	 * 行動半径を返却
	 * @readonly
	 * @memberof LandBase
	 */
	getRange() {
		let minRange = 999;
		let maxLos = 1;
		for (const plane of this.planes) {

			if (!plane.id) {
				continue;
			}

			// 最も短い半径
			minRange = plane.radius < minRange ? plane.radius : minRange;

			// 偵察機の中でで最も長い半径を取得
			if (plane.isRecon) {
				maxLos = maxLos < plane.radius ? plane.radius : maxLos;
			}
		}

		if (maxLos < 999 && maxLos > minRange) return Math.round(minRange + Math.min(Math.sqrt(maxLos - minRange), 3));
		else return minRange === 999 ? 0 : minRange;
	}

	/**
	 * 現航空隊の出撃時燃料消費を返却
	 * @readonly
	 * @memberof LandBase
	 */
	getSumFuel() {
		return getArraySum(this.planes.map(v => v.fuel));
	}

	/**
	 * 現航空隊の出撃時弾薬消費を返却
	 * @readonly
	 * @memberof LandBase
	 */
	getSumAmmo() {
		return getArraySum(this.planes.map(v => v.ammo));
	}

	/**
	 * 現航空隊の配備時ボーキを返却
	 * @readonly
	 * @memberof LandBase
	 */
	getSumBauxite() {
		return getArraySum(this.planes.map(v => v.bauxite));
	}

	/**
	 * 現航空隊の噴式発生時コストを返却
	 * @readonly
	 * @memberof LandBase
	 */
	getSumSteel() {
		return getArraySum(this.planes.map(v => v.steel));
	}
}

/**
 * Plane 通常機体
 * @class
 */
class Plane {
	/**
	 *Creates an instance of Plane.
	 * @param {number} id
	 * @param {number} [slot=0]
	 * @param {number} [remodel=0]
	 * @param {number} [level=0]
	 * @memberof Plane
	 */
	constructor(id, slot = 0, remodel = 0, level = 0) {
		/** @type {number} */
		this.id = 0;
		/** @type {string} */
		this.name = '-';
		/** @type {number} */
		this.type = 0;
		/** @type {number} */
		this.antiAir = 0;
		/** @type {number} */
		this.bonusAntiAir = 0;
		/** @type {number} */
		this.antiBomber = 0;
		/** @type {number} */
		this.interception = 0;
		/** @type {number} */
		this.scout = 0;
		/** @type {number} */
		this.airPower = 0;
		/** @type {number} */
		this.fullAirPower = 0;
		/** @type {number} */
		this.radius = 0;
		/** @type {number} */
		this.cost = 0;
		/** @type {number} */
		this.accuracy = 0;
		/** @type {number} */
		this.avoid = 0;
		/** @type {boolean} */
		this.isFighter = false;
		/** @type {boolean} */
		this.isRecon = false;
		/** @type {boolean} */
		this.isAttacker = false;
		/** @type {boolean} */
		this.canBattle = false;
		/** @type {number} */
		this.contact = 0;
		/** @type {Array<number>} */
		this.selectRate = [];
		/** @type {number} */
		this.fullSlot = 0;
		/** @type {number} */
		this.slot = slot;
		/** @type {number} */
		this.remodel = 0;
		/** @type {number} */
		this.level = 0;
		/** @type {number} */
		this.fuel = 0;
		/** @type {number} */
		this.ammo = 0;
		/** @type {number} */
		this.bauxite = 0;
		/** @type {number} */
		this.steel = 0;
		/** @type {number} */
		this.bonusAirPower = 0;
		/** @type {number} */
		this.slotNo = 0;

		const plane = PLANE_DATA.find(v => v.id === id);
		if (plane) {
			// 基本ステータス
			this.id = plane.id;
			this.name = plane.abbr ? plane.abbr : plane.name;
			this.type = plane.type;
			this.antiAir = plane.antiAir;
			this.antiBomber = plane.antiBomber;
			this.interception = plane.interception;
			this.scout = plane.scout;
			this.radius = plane.radius;
			this.cost = plane.cost;
			this.accuracy = plane.accuracy;
			this.avoid = plane.avoid;
			this.isFighter = FIGHTERS.includes(plane.type);
			this.isAttacker = ATTACKERS.includes(plane.type);
			this.isRecon = RECONNAISSANCES.includes(plane.type);
			this.canBattle = !this.isRecon;
			this.remodel = remodel;
			this.level = level;

			// スロット数審査 & 格納
			this.validateSlot(slot);

			// スロット数によって変動しない制空値ボーナス計算
			this.calcBonusAirPower();

			// 改修値による対空値ボーナスの計算
			this.bonusAntiAir = Plane.getBonusAntiAir(this.id, this.type, this.remodel, this.antiAir);
			this.antiAir += this.bonusAntiAir;

			// 制空値算出
			this.updateAirPower();

			// 触接関連
			if (this.slot > 0) {
				// 触接開始因数
				this.contact = this.isRecon ? Math.floor(this.scout * Math.sqrt(this.slot)) : 0;
				// 触接選択率
				this.selectRate = getContactSelectRate(this);
			}

			// 出撃コスト加算
			const isLbAtaccker = [101, -101].includes(this.type);
			this.fuel = Math.ceil(this.slot * (isLbAtaccker ? 1.5 : this.type === 105 ? 2.0 : 1.0));
			this.ammo = isLbAtaccker ? Math.floor(this.slot * 0.7) : this.type === 105 ? this.slot * 2 : Math.ceil(this.slot * 0.6);
			this.bauxite = this.cost * (this.isRecon ? 4 : this.type === 105 ? 9 : 18);
			this.steel = this.type === 9 ? Math.round(this.slot * this.cost * 0.2) : 0;

			// 補給時制空値
			this.fullAirPower = this.airPower;
		}
	}

	/**
	 * 現在の搭載数から制空値を算出、更新する
	 * @memberof Plane
	 */
	updateAirPower() {
		if (this.isRecon || this.slot <= 0 || this.id === 0) {
			this.airPower = 0;
			if (this.slot < 0) {
				this.slot = 0;
			}
		}
		else {
			// 基本制空値 + ボーナス制空値
			this.airPower = Math.floor(this.antiAir * Math.sqrt(this.slot) + this.bonusAirPower);
		}
	}

	/**
	 * 搭載数によって変動しないボーナスの制空値
	 * @returns {number}
	 * @memberof Plane
	 */
	calcBonusAirPower() {
		if (this.id === 0 || this.slot === 0) return 0;
		const type = this.type;
		const level = this.level;
		let sumPower = 0.0;

		// 艦戦 夜戦 水戦
		if (this.isFighter) {
			switch (level) {
				case 7:
					sumPower += 22;
					break;
				case 2:
					sumPower += 2;
					break;
				case 3:
					sumPower += 5;
					break;
				case 4:
					sumPower += 9;
					break;
				case 5:
					sumPower += 14;
					break;
				case 6:
					sumPower += 14;
					break;
				default:
					break;
			}
		}
		// 水爆
		else if (type === 6) {
			switch (level) {
				case 2:
					sumPower += 1;
					break;
				case 3:
					sumPower += 1;
					break;
				case 4:
					sumPower += 1;
					break;
				case 5:
					sumPower += 3;
					break;
				case 6:
					sumPower += 3;
					break;
				case 7:
					sumPower += 6;
					break;
				default:
					break;
			}
		}

		// 内部熟練度ボーナス
		sumPower += Math.sqrt(getInnerProficiency(level, type) / 10);

		this.bonusAirPower = sumPower;
	}

	/**
	 * 艦載機カテゴリ、改修値からボーナス対空値を返却
	 * @static
	 * @param {number} id 機体id
	 * @param {number} type 機体カテゴリコード
	 * @param {number} remodel 改修値
	 * @param {number} prevAntiAir 素の対空値
	 * @returns {number} ボーナス対空値
	 * @memberof Plane
	 */
	static getBonusAntiAir(id, type, remodel, prevAntiAir) {
		let aa = 0;
		// 艦戦 夜戦 水戦
		if (FIGHTERS.includes(type)) {
			aa = 0.2 * remodel;
		}
		// 艦爆
		else if (type === 3 && prevAntiAir > 2 && id !== 316) {
			aa = 0.25 * remodel;
		}
		// 陸攻
		else if (type === 101 || type === 105) {
			aa = 0.5 * Math.sqrt(remodel);
		}
		return aa;
	}

	/**
	 * 艦載機カテゴリ、改修値からボーナス雷装値を返却
	 * @static
	 * @param {number} type 機体カテゴリコード
	 * @param {number} remodel 改修値
	 * @returns {number} ボーナス雷装値
	 * @memberof Plane
	 */
	static getBonusTorpedo(type, remodel) {
		let bonus = 0;
		// 艦攻
		if (type === 2 || type === -2) {
			bonus = 0.2 * remodel;
		}
		// 陸攻 重爆
		else if (type === 101 || type === 105) {
			bonus = 0.7 * Math.sqrt(remodel);
		}
		return bonus;
	}

	/**
	 * 艦載機カテゴリ、改修値からボーナス爆装値を返却
	 * @static
	 * @param {number} type 機体カテゴリコード
	 * @param {number} remodel 改修値
	 * @param {number} antiAir 対空値
	 * @returns {number} ボーナス爆装値
	 * @memberof Plane
	 */
	static getBonusBomber(type, remodel, antiAir) {
		let bonus = 0;
		// 艦爆
		if (type === 3 && antiAir <= 2) {
			bonus = 0.2 * remodel;
		}
		// 水爆
		else if (type === 6) {
			bonus = 0.2 * remodel;
		}
		return bonus;
	}

	/**
	 * スロット数バリデーション
	 * 正しい値に修正したうえで自身に格納
	 * @param {object} value
	 * @memberof Plane
	 */
	validateSlot(value) {
		const slot = castInt(value);
		if (slot > MAX_SLOT) {
			this.slot = MAX_SLOT;
			this.fullSlot = MAX_SLOT;
		}
		else {
			this.slot = slot;
			this.fullSlot = slot;
		}
	}
}

/**
 * 艦娘用機体クラス
 * @class ShipPlane
 * @extends {Plane}
 */
class ShipPlane extends Plane {
	/**
	 *Creates an instance of ShipPlane.
	 * @param {number} id
	 * @param {number} [slot=0]
	 * @param {number} [remodel=0]
	 * @param {number} [level=0]
	 * @memberof ShipPlane
	 */
	constructor(id, slot = 0, remodel = 0, level = 0) {
		super(id, slot, remodel, level);
		/** @type {Array<number>} */
		this.results = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
	}
}

/**
 * 基地航空隊用機体クラス
 * @class LandBasePlane
 * @extends {Plane}
 */
class LandBasePlane extends Plane {
	/**
	 *Creates an instance of LandBasePlane.
	 * @param {number} id
	 * @param {number} [slot=0]
	 * @param {number} [remodel=0]
	 * @param {number} [level=0]
	 * @memberof LandBasePlane
	 */
	constructor(id, slot = 0, remodel = 0, level = 0) {
		super(id, slot, remodel, level);
		/** @type {number} */
		this.defenseAirPower = 0;

		// 防空計算
		this.updateDefenseAirPower();
	}

	/**
	 * オーバーライド
	 * 現在の搭載数から基地航空隊配備時の制空値を算出、更新する
	 * @memberof LandBasePlane
	 */
	updateAirPower() {
		if (this.slot <= 0) {
			this.airPower = 0;
			this.slot = 0;
			return;
		}

		let sumPower = this.bonusAirPower;

		if (this.isFighter) {
			// 艦戦系
			sumPower += (this.antiAir + 1.5 * this.interception) * Math.sqrt(this.slot);
		}
		// 陸偵
		else if (this.type === 104) {
			// 搭載4★2以上を制空値+1
			sumPower += this.antiAir * Math.sqrt(this.slot) + (this.remodel >= 2 && this.slot === 4 ? 1 : 0);
		}
		else if (this.id === 138) {
			// 二式大艇 搭載4★4で制空+1
			sumPower += this.antiAir * Math.sqrt(this.slot) + (this.remodel >= 4 && this.slot === 4 ? 1 : 0);
		}
		// その他
		else sumPower += this.antiAir * Math.sqrt(this.slot);

		this.airPower = Math.floor(sumPower);
	}

	/**
	 * 現在の搭載数から防空時の制空値を算出、更新する
	 * @memberof Plane
	 */
	updateDefenseAirPower() {
		if (this.id === 0 || this.slot <= 0) {
			this.defenseAirPower = 0;
			this.slot = 0;
			return;
		}

		let sumPower = this.bonusAirPower;
		if (this.isFighter) {
			sumPower += (this.antiAir + this.interception + 2.0 * this.antiBomber) * Math.sqrt(this.slot);
		}
		// 陸偵
		else if (this.type === 104) {
			// 搭載4★2以上を制空値+1
			sumPower += this.antiAir * Math.sqrt(this.slot) + (this.remodel >= 2 && this.slot === 4 ? 1 : 0);
		}
		else if (this.id === 138) {
			// 二式大艇 搭載4★4で制空+1
			sumPower += this.antiAir * Math.sqrt(this.slot) + (this.remodel >= 4 && this.slot === 4 ? 1 : 0);
		}
		// その他
		else sumPower += this.antiAir * Math.sqrt(this.slot);

		this.defenseAirPower = Math.floor(sumPower);
	}

	/**
	 * 基地航空隊スロット数バリデーション
	 * 正しい値に修正したうえで自身に格納
	 * @param {object} value 入力値
	 */
	validateSlot(value) {
		const slot = castInt(value);
		if (slot === 0) {
			// 不正な値は0
			this.slot = 0;
			this.fullSlot = 0;
		}
		else if (this.isRecon && slot > 4) {
			// 偵察機は4機以下
			this.slot = 4;
			this.fullSlot = 4;
		}
		else if (this.type === 105 && slot > 9) {
			// 重爆機は9機以下
			this.slot = 9;
			this.fullSlot = 9;
		}
		else if (slot > 18) {
			// それ以外で18機を超えていたら18機
			this.slot = 18;
			this.fullSlot = 18;
		}
		else {
			this.slot = slot;
			this.fullSlot = slot;
		}
	}
}

/**
 * 基地制空戦結果
 * @class
 */
class AirStatusResult {
	constructor() {
		/** @type {Array<number>} */
		this.mainAirPower = [0, 0];
		/** @type {Array<number>} */
		this.enemyAirPower = [0, 0];
		/** @type {Array<Array<number>>} */
		this.airStatusIndex = [[0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]];
	}
}


class BattleData {
	constructor() {
		/** @type {Array<Battle>} */
		this.battles = [];
	}
}

class Battle {
	constructor() {
		/** @type {Array<Enemy>} */
		this.enemies = [];
		/** @type {number} */
		this.cellType = 0;
		/** @type {any} */
		this.stage2 = [];
		/** @type {boolean} */
		this.isAllSubmarine = false;
		/** @type {number} */
		this.formation = 0;
	}

	/**
	 * この戦闘の現在の制空値を返却 - 基地
	 * @returns 制空値
	 * @memberof Battle
	 */
	getLandBaseAirPower() {
		let sumAP = 0;
		const max_i = this.enemies.length;
		for (let i = 0; i < max_i; i++) {
			sumAP += this.enemies[i].landBaseAirPower;
		}
		return sumAP;
	}

	/**
	 * この戦闘の現在の制空値を返却 - 通常
	 * @returns 制空値
	 * @memberof Battle
	 */
	getAirPower() {
		let sumAP = 0;
		const max_i = this.enemies.length;
		for (let i = 0; i < max_i; i++) {
			sumAP += this.enemies[i].airPower;
		}
		return sumAP;
	}

	/**
	 * この敵艦隊クラスからstage2テーブルを生成
	 */
	createStage2Table() {
		const stage2 = [[[], []], [[], []], [[], []], [[], []], [[], []], [[], []]];
		const enemyCount = this.enemies.length;

		if (enemyCount === 0) {
			return;
		}

		// 詳細設定入力欄の値を格納
		AVOID_TYPE[5].adj[0] = castFloat($('#free_anti_air_weight').val());
		AVOID_TYPE[5].adj[1] = castFloat($('#free_anti_air_bornus').val());

		// 連合艦隊
		const isUnion = this.cellType === CELL_TYPE.grand;

		// 陣形補正
		const formation = FORMATION.find(v => v.id === this.formation);
		const aj1 = formation ? formation.correction : 1.0;
		// 艦隊防空ボーナス合計
		const sumAntiAirBonus = Math.floor(getArraySum(this.enemies.map(v => v.antiAirBonus)));
		// 艦隊防空 => int(陣形補正 * 各艦の艦隊対空ボーナス合計)
		const fleetAntiAir = Math.floor(sumAntiAirBonus * aj1);

		for (let i = 0; i < enemyCount; i++) {
			const enm = this.enemies[i];
			if (enm.id === 0) continue;

			// 連合艦隊補正
			const unionFactor = isUnion && enm.isEscort ? 0.48 : isUnion && !enm.isEscort ? 0.8 : 1.0;

			// 各回避補正毎にテーブルを作成
			for (let j = 0; j < AVOID_TYPE.length; j++) {
				// 対空射撃補正
				const avoid1 = AVOID_TYPE[j].adj[0];
				const avoid2 = AVOID_TYPE[j].adj[1];

				// 艦船加重対空値
				let antiAirWeight = 0;
				if (avoid1 === 1.0) {
					// 艦船加重対空値 => int(sqrt(素対空 + 装備対空)) + Σ(装備対空値 * 装備倍率)
					antiAirWeight = Math.floor(Math.sqrt(enm.antiAir + enm.sumItemAntiAir)) + enm.equipmentsAAWeight;
				}
				else {
					// 艦船加重対空値 => int((int(sqrt(素対空 + 装備対空)) + Σ(装備対空値 * 装備倍率)) * 対空射撃回避補正)
					antiAirWeight = Math.floor((Math.floor(Math.sqrt(enm.antiAir + enm.sumItemAntiAir)) + enm.equipmentsAAWeight) * avoid1);
				}

				// 艦隊防空補正
				let fleetAA = 0;
				if (avoid2 === 1.0) {
					// 艦隊防空補正 => 艦隊防空
					fleetAA = fleetAntiAir;
				}
				else {
					// 艦隊防空補正 => int(艦隊防空 * 対空射撃回避補正(艦隊防空ボーナス))
					fleetAA = Math.floor(fleetAntiAir * avoid2);
				}

				// 割合撃墜 => int(0.02 * 0.25 * 機数[あとで] * 艦船加重対空値 * 連合補正)
				stage2[j][0].push(0.02 * 0.25 * antiAirWeight * unionFactor);
				// 固定撃墜 => int((加重対空値 + 艦隊防空補正) * 基本定数(0.25) * 敵補正(0.75) * 連合補正)
				stage2[j][1].push(Math.floor((antiAirWeight + fleetAA) * 0.75 * 0.25 * unionFactor));
			}
		}

		this.stage2 = stage2;
	}
}

class Enemy {
	/**
	 * Creates an instance of Enemy.
	 * @param {number} id
	 * @memberof Enemy
	 */
	constructor(id) {
		/** @type {number} */
		this.id = 0;
		/** @type {Array<number>} */
		this.type = [];
		/** @type {string} */
		this.name = "";
		/** @type {Array<number>} */
		this.antiAirs = [];
		/** @type {Array<number>} */
		this.slots = [];
		/** @type {Array<number>} */
		this.fullSlots = [];
		/** @type {Array<number>} */
		this.rawSlots = [];
		/** @type {number} */
		this.airPower = 0;
		/** @type {number} */
		this.fullAirPower = 0;
		/** @type {number} */
		this.landBaseAirPower = 0;
		/** @type {number} */
		this.fullLandBaseAirPower = 0;
		/** @type {number} */
		this.antiAirWeight = 0;
		/** @type {number} */
		this.antiAirBonus = 0;
		/** @type {Array<boolean>} */
		this.attackers = [];
		/** @type {Array<Equipment>} */
		this.equipments = [];
		/** @type {boolean} */
		this.onlyScout = false;
		/** @type {number} */
		this.antiAir = 0;
		/** @type {number} */
		this.sumItemAntiAir = 0;
		/** @type {number} */
		this.equipmentsAAWeight = 0;
		/** @type {boolean} */
		this.isEscort = false;

		const raw = ENEMY_DATA.find(v => v.id === id);
		if (raw) {
			for (let i = 0; i < raw.eqp.length; i++) {
				const id = raw.eqp[i];
				// 装備マスタから取得
				const equipment = new Equipment(id);
				// 装備対空加算
				this.sumItemAntiAir += equipment.antiAir;
				// 装備対空 * 装備倍率 加算
				this.equipmentsAAWeight += equipment.antiAirWeight;
				// 艦隊防空ボーナス加算 この後小数点以下切り捨て
				this.antiAirBonus += equipment.antiAirBonus;

				// 装備品追加
				this.equipments.push(equipment);

				// 機体なら計算用の格納
				if (equipment && equipment.type < 1000) {
					const slot = raw.slot[i] > 0 ? raw.slot[i] : 0;
					this.antiAirs.push(equipment.antiAir);
					this.attackers.push(ATTACKERS.includes(equipment.type));
					this.slots.push(slot);
					this.fullSlots.push(slot);

					// いまは偵察機が1つでも含まれてたら偵察機onlyとする => 基地制空のみに加算
					if (!this.onlyScout && equipment.type === 5) {
						this.onlyScout = true;
					}
				}
			}

			this.id = raw.id;
			this.type = raw.type;
			this.name = raw.name;
			this.antiAir = raw.aa;
			this.airPower = 0;
			this.landBaseAirPower = 0;
			this.rawSlots = raw.slot.concat();

			// 制空値情報の更新
			this.updateAirPower();

			this.fullAirPower = this.airPower;
			this.fullLandBaseAirPower = this.landBaseAirPower;

			// 艦船加重対空(表示用ブラウザ版2倍 計算には特に使わない) => int( sqrt(素対空 + 装備対空) ) + Σ(装備対空 * 装備倍率) 
			this.antiAirWeight = 2 * Math.floor(Math.sqrt(this.antiAir + this.sumItemAntiAir)) + 2 * this.equipmentsAAWeight;
			// 艦隊防空ボーナス切捨て
			this.antiAirBonus = Math.floor(this.antiAirBonus);
		}
	}

	updateAirPower() {
		if (this.id < 0) return;
		this.airPower = 0;
		this.landBaseAirPower = 0;
		const max_i = this.antiAirs.length;
		let sumAp = 0;
		for (let i = 0; i < max_i; i++) {
			sumAp += Math.floor(this.antiAirs[i] * Math.sqrt(Math.floor(this.slots[i])));
		}
		this.landBaseAirPower = sumAp;

		if (!this.onlyScout) {
			this.airPower = sumAp;
		}
	}
}

/**
 * 装備品クラス いまは対空砲火用プロパティのみ
 * @class Equipment
 */
class Equipment {
	/**
	 *Creates an instance of Equipment.
	 * @param {number} id
	 * @memberof Equipment
	 */
	constructor(id) {
		/** @type {number} */
		this.id = 0;
		/** @type {number} */
		this.type = 0;
		/** @type {string} */
		this.name = "";
		/** @type {number} */
		this.antiAir = 0;
		/** @type {number} */
		this.antiAirWeight = 0;
		/** @type {number} */
		this.antiAirBonus = 0;

		const raw = ENEMY_PLANE_DATA.find(v => v.id === id);
		if (raw) {
			this.id = raw.id;
			this.name = raw.name;
			this.type = raw.type;
			this.antiAir = raw.antiAir;

			// 加重対空値部品 => 装備対空値 * 装備倍率
			if (this.type === 1002) {
				// 高角砲
				this.antiAirWeight = this.antiAir * 2;

			} else if (this.type === 1004) {
				// 電探
				this.antiAirWeight = this.antiAir * 1.5;
			}
			else if (this.type === 1005) {
				// 機銃
				this.antiAirWeight = this.antiAir * 3;
			}

			// 艦隊防空ボーナス
			if (this.type === 1002) {
				// 高角砲
				this.antiAirBonus = this.antiAir * 0.35
			}
			else if (this.type === 1004) {
				// 電探
				this.antiAirBonus = this.antiAir * 0.4
			}
			else if (this.type === 1006) {
				// 対空強化弾(三式 該当なし)
				this.antiAirBonus = this.antiAir * 0.6
			}
			else {
				// その他
				this.antiAirBonus = this.antiAir * 0.2;
			}

		}
	}
}

/*
	プリセットメモ
	全体: [0:id, 1:名前, 2:[0:基地プリセット, 1:艦隊プリセット, 2:敵艦プリセット, 3:対空プリセット, 4: 防空モードかどうか], 3:メモ, 4:更新日時]
		基地: [0:機体群, 1:札群, 2:ターゲット戦闘番号[1-1, 1-2, 2-1, ..., 3-2]]
		艦隊: [0:id, 1: plane配列, 2: 配属位置, 3:無効フラグ, 4:練度]
			機体: [0:id, 1:熟練, 2:改修値, 3:搭載数, 4:スロット位置, 5: スロットロック(任意、ロック済みtrue]
		敵艦: [0:戦闘位置, 1:enemyId配列(※ 直接入力時は負値で制空値), 2:マス名, 3:マス種別, 4:陣形, 5:半径]
		対空: [0:対空CI毎撃墜テーブル, 1:基準艦隊防空, 2:(v1.9.1～未使用), 3:連合フラグ, 4:空襲フラグ, 5:入力加重対空値, 6:陣形]
		防空モード: そのまんま boolean
		防空モード敵艦隊: { 0: [enemyId配列], 1: マス種別, 2: 陣形 }
	在庫メモ
	[0:id, 1:[0:未改修数, 1:★1数, ... 10:★MAX数]]
*/
/*==================================
		汎用
==================================*/
/**
 * arrayとdiffArray内に1つでも同じ値がある場合true
 * @param {Array} array
 * @param {Array} diffArray
 * @returns 同じ値が1つでも両配列に存在すればtrue
 */
function isContain(array, diffArray) {
	for (const value1 of array) {
		for (const value2 of diffArray) {
			if (value1 === value2) return true;
		}
	}
	return false;
}

/**
 * 配列のシャッフル (Fisher-Yates shuffle)
 * @param {Array} array
 */
function shuffleArray(array) {
	const length = array.length;
	for (let i = length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const tmp = array[i];
		array[i] = array[j];
		array[j] = tmp;
	}
}

/**
 * 指定したinputのvalueをクリップボードにコピー
 * @param {JQuery} $this inputタグ id 持ち限定
 * @returns {boolean} 成功したらtrue
 */
function copyInputTextToClipboard($this) {
	try {
		if (!$this.attr('id')) return false;
		const t = document.getElementById($this.attr('id'));
		t.select();
		return document.execCommand('copy');
	} catch (error) {
		return false;
	}
}

/**
 * 数値配列の合計値を返却(処理速度優先)
 * @param {Array<number>} array 数値配列
 * @returns {number} 合計値
 */
function getArraySum(array) {
	let sum = 0;
	let i = array.length;
	while (i--) {
		sum += array[i];
	}
	return sum;
}

/**
 * 数値配列の最大値を返却(処理速度優先 / 大きい値でapplyやスプレッド演算子が落ちるため)
 * @param {Array<number>} array 数値配列
 * @returns {number} 合計値
 */
function getArrayMax(array) {
	let max = -Infinity;
	let i = array.length;
	while (i--) {
		if (array[i] > max) max = array[i];
	}
	return max;
}

/**
 * 数値配列の最小値を返却(処理速度優先 / 大きい値でapplyやスプレッド演算子が落ちるため)
 * @param {Array<number>} array 数値配列
 * @returns {number} 合計値
 */
function getArrayMin(array) {
	let min = Infinity;
	let i = array.length;
	while (i--) {
		if (array[i] < min) min = array[i];
	}
	return min;
}

/**
 * RGBに変換
 * @param {string} hex
 */
function hexToRGB(hex) {
	if (hex.slice(0, 1) == "#") hex = hex.slice(1);
	if (hex.length == 3) hex = hex.slice(0, 1) + hex.slice(0, 1) + hex.slice(1, 2) + hex.slice(1, 2) + hex.slice(2, 3) + hex.slice(2, 3);
	return [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)].map(function (str) {
		return parseInt(str, 16);
	});
}

/*==================================
		値/オブジェクト 作成・操作・取得等
==================================*/

/**
 * 事前計算テーブルがメモリになければ生成
 */
function setPreCalculateTable() {
	// 制空ボーダーテーブル
	if (!AIR_STATUS_TABLE) {
		AIR_STATUS_TABLE = [];
		const max_ap = 1000;
		for (let i = 0; i <= max_ap; i++) {
			const tmp = new Uint16Array(Math.max(3 * i + 1, 2));
			for (let j = 0; j <= tmp.length; j++) {
				if (i === 0 && j === 0) tmp[j] = 5;
				else if (i >= 3 * j) tmp[j] = 0;
				else if (2 * i >= 3 * j) tmp[j] = 1;
				else if (3 * i > 2 * j) tmp[j] = 2;
				else if (3 * i > j) tmp[j] = 3;
				else {
					tmp[j] = 4;
					break;
				}
			}
			AIR_STATUS_TABLE.push(tmp);
		}
	}

	// 自軍撃墜テーブル
	if (!SHOOT_DOWN_TABLE) {
		SHOOT_DOWN_TABLE = [];
		const c_max = [1, 3, 5, 7, 10];
		for (let slot = 0; slot <= MAX_SLOT; slot++) {
			const tmpA = [];
			for (const v of c_max) {
				const max = v / 3;
				let tmpB = [];
				for (let i = 0; i <= max; i += 0.01) {
					tmpB.push(slot * (i + v / 4) / 10);
				}

				if (tmpB.findIndex(v => v >= 1) === -1) {
					tmpB = [0];
				}
				else {
					shuffleArray(tmpB);
				}
				tmpA.push(tmpB);
			}
			SHOOT_DOWN_TABLE.push(tmpA);
		}
	}

	// 敵撃墜テーブル
	if (!SHOOT_DOWN_TABLE_ENEMY) {
		SHOOT_DOWN_TABLE_ENEMY = [];
		let enemyMaxSlot = 0;
		const enemyLen = ENEMY_DATA.length;
		for (let i = 0; i < enemyLen; i++) {
			const slotLen = ENEMY_DATA[i].slot.length;
			for (let j = 0; j < slotLen; j++) {
				if (enemyMaxSlot < ENEMY_DATA[i].slot[j]) enemyMaxSlot = ENEMY_DATA[i].slot[j];
			}
		}
		for (let slot = 0; slot <= enemyMaxSlot; slot++) {
			const tmpA = [];
			const airLen = AIR_STATUS.length;
			for (let i = 0; i < airLen; i++) {
				let tmpB = [];
				const rand_max = AIR_STATUS[i].rate;
				for (let x = rand_max; x >= 0; x--) {
					for (let y = 0; y <= rand_max; y++) {
						const value = Math.floor(slot * (0.65 * x + 0.35 * y) / 10);
						tmpB.push(value);
					}
				}
				if (tmpB.findIndex(v => v >= 1) === -1) {
					tmpB = [0];
				}
				else {
					shuffleArray(tmpB);
				}
				tmpA.push(tmpB);
			}
			SHOOT_DOWN_TABLE_ENEMY.push(tmpA);
		}
	}

	// メモリ解放タイマー設定
	window.clearTimeout(releaseTimer);
	// 3分おきに重いメモリ解放
	releaseTimer = setTimeout(function () {
		AIR_STATUS_TABLE = null;
		SHOOT_DOWN_TABLE = null;
		SHOOT_DOWN_TABLE_ENEMY = null;
	}, 180000);
}

/**
 * 艦載機カテゴリで艦載機をフィルタし返却
 * @param {number} type カテゴリ　0の場合、全艦載機
 * @returns {object} 艦載機データ
 */
function getPlanes(type) {
	let planes = [];
	if (type === 0) planes = basicSortedPlanes.concat();
	else planes = PLANE_DATA.filter(v => Math.abs(v.type) === Math.abs(castInt(type)));
	return planes;
}

/**
 * 艦載機カテゴリアイコンで艦載機をフィルタし返却
 * @param {number} type カテゴリ　0の場合、全艦載機
 * @returns {object} 艦載機データ
 */
function getPlanesForIcon(type) {
	let planes = [];
	if (type === 0) planes = basicSortedPlanes.concat();
	else if (type === 3) planes = PLANE_DATA.filter(v => v.type === 3 || v.type === 9);
	else if (type === 4) planes = PLANE_DATA.filter(v => v.type === 4 || v.type === 104);
	else if (type === 5) planes = PLANE_DATA.filter(v => [5, 6, 7, 8].includes(v.type));
	else if (type === 101) planes = PLANE_DATA.filter(v => [101, -101, 105].includes(v.type));
	else planes = PLANE_DATA.filter(v => Math.abs(v.type) === Math.abs(castInt(type)));
	return planes;
}

/**
 * 機体カテゴリからcssクラスを返却
 * @param {number} typeCd カテゴリコード
 * @returns {string} cssクラス名
 */
function getPlaneCss(typeCd) {
	const typeData = PLANE_TYPE.find(v => v.id === castInt(typeCd));
	return typeData ? typeData.css : '';
}

/**
 * 熟練度レベルから文字を返却
 * @param {number} remodel 熟練度lv
 * @returns {string}
 */
function getProfString(remodel) {
	switch (remodel) {
		case 1:
			return "|";
		case 2:
			return "||";
		case 3:
			return "|||";
		case 4:
			return "/";
		case 5:
			return "//";
		case 6:
			return "///";
		case 7:
			return ">>";
	}
	return "";
}

/**
 * 漢数字を数字に変換
 * @param {string} word 入力値
 */
function replaceKnji(word) {
	if (word) {
		word = word.replace('601', '六〇一');
		word = word.replace('634', '六三四');
		word = word.replace('931', '九三一');
		word = word.replace('22', '二二');
		word = word.replace('34', '三四');
		word = word.replace('96', '九六');
		word = word.replace('97', '九七');
		word = word.replace('99', '九九');
	}
	return word;
}

/**
 * 第1引数のidの艦娘に対する第2引数の艦載機の適正 装備可能ならtrue
 * 基地ならtrue 艦娘未指定なら基地機体以外true
 * @param {number} shipID 艦娘id(基地航空隊:-1 艦娘未指定:0 艦娘:艦娘id)
 * @param {Object} plane 艦載機オブジェクト data.js参照
 * @returns {boolean} 装備できるなら true
 */
function checkInvalidPlane(shipID, plane) {
	if (shipID === -1) return true;
	if (shipID === 0 && Math.abs(plane.type) > 100) return false;
	else if (shipID === 0) return true;
	const ship = SHIP_DATA.find(v => v.id === shipID);
	const basicCanEquip = LINK_SHIP_EQUIPMENT.find(v => v.type === ship.type);
	const special = SPECIAL_LINK_SHIP_EQUIPMENT.find(v => v.shipId === ship.id);
	let canEquip = [];
	if (basicCanEquip) {
		for (const v of basicCanEquip.e_type) canEquip.push(v);
		if (special) for (const i of special.equipmentTypes) canEquip.push(i);
	}

	// 基本装備可能リストにない場合
	if (!canEquip.includes(Math.abs(plane.type))) {
		// 敗者復活 (特別装備可能idに引っかかっていないか)
		return special && special.equipmentIds.includes(plane.id);
	}

	// 試製景雲チェック
	if (plane.id === 151) {
		if (!special) return false;
		return special.equipmentIds.includes(plane.id);
	}

	return true;
}

/**
 * 数値入力バリデーション
 * @param {string} value 入力文字列
 * @param {number} max 最大値
 * @param {number} min 最小値　未指定時0
 * @returns {number} 検証結果数値
 */
function validateInputNumber(value, max, min = 0) {
	const regex = new RegExp(/^[0-9]+$/);
	let ret = 0;

	if (!regex.test(value)) ret = min;
	else if (value > max) ret = max;
	else if (value < min) ret = min;
	else ret = castInt(value);

	return ret;
}

/**
 * 数値入力バリデーション
 * @param {string} value 入力文字列
 * @param {number} max 最大値
 * @param {number} min 最小値　未指定時0
 * @returns {number} 検証結果数値
 */
function validateInputNumberFloat(value, max, min = 0) {
	const regex = new RegExp(/^\d+(\.\d+)?$/);
	let ret = 0;

	if (value.length > 5) value = value.slice(0, 5);
	else if (value.length === 0) value = "0";

	if (!regex.test(value)) ret = min;
	else if (value > max) ret = max;
	else if (value < min) ret = min;
	else ret = castFloat(value);

	return ret;
}

/*==================================
		DOM 操作
==================================*/
/**
 * メイン画面初期化処理
 * 初期DOM構築 事前計算 等
 * @param {*} callback コールバック
 */
function initialize(callback) {
	let text = '';

	// カテゴリのプリロード
	for (let i = 0; i < PLANE_TYPE.length; i++) {
		const img = new Image();
		const id = PLANE_TYPE[i].id;
		img.src = '../img/type/type' + id + '.png';
		IMAGES["type" + id] = img;
	}

	// 手動設定敵艦情報でマスタを書き換える
	let manualEnemies = loadLocalStorage('manual_enemies');
	if (manualEnemies) {
		manualEnemies = manualEnemies.filter(v => UNKNOWN_ENEMY.includes(v.id));
		saveLocalStorage('manual_enemies', manualEnemies);
		for (const enemy of manualEnemies) {
			if (UNKNOWN_ENEMY.includes(enemy.id)) {
				const index = ENEMY_DATA.findIndex(v => v.id === enemy.id);
				ENEMY_DATA[index] = enemy;
			}
		}
	}

	// 機体カテゴリ初期化
	const planeTypes = PLANE_TYPE.filter(v => v.id > 0).map(v => v.id);
	setPlaneTypeIconSelect(document.getElementById('plane_type_select'), planeTypes);
	setPlaneType(document.getElementById('stock_type_select'), planeTypes);
	setPlaneTypeIconSelect(document.getElementById('draggable_plane_type_select'), planeTypes, true);

	$('#plane_filter_key_select').val('radius');
	$('#plane_filter_value').val(0);

	// デフォ機体群定義
	let tempList = document.getElementById('stock_type_select').getElementsByTagName('option');
	for (const option of tempList) {
		basicSortedPlanes = basicSortedPlanes.concat(PLANE_DATA.filter(v => Math.abs(v.type) === castInt(option.value)));
	}

	// 艦種初期化
	setShipType(SHIP_TYPE.map(v => v.id));
	// 敵艦種初期化
	setEnemyType(ENEMY_TYPE.filter(v => v.id > 0).map(v => v.id));

	// 最終状態のみ表示
	document.getElementById('display_final')['checked'] = setting.visibleFinal;
	document.getElementById('frequent_ship')['checked'] = setting.orderByFrequency;

	// 基地簡易ビュー複製
	text = document.getElementById('lb_info_table').getElementsByTagName('tbody')[0].innerHTML;
	for (let i = 0; i < 2; i++) document.getElementById('lb_info_table').getElementsByTagName('tbody')[0].innerHTML += text;
	tempList = document.getElementsByClassName('lb_info_tr');
	for (let i = 0; i < tempList.length; i++) {
		const e = tempList[i];
		e.classList.add(`lb_info_lb_${Math.floor(i / 4) + 1}`);
		const n = e.getElementsByClassName('info_name');
		if (n.length) n[0].textContent = `第${Math.floor(i / 4) + 1}基地航空隊`;
	}

	// 表示隻数初期化
	tempList = document.getElementsByClassName('display_ship_count');
	for (const e of tempList) e.value = 2;

	// 敵艦隊欄複製
	text = $('#battle_container').html();
	for (let index = 1; index < 10; index++) $('#battle_container').append(text);
	$('.battle_content').each((i, e) => {
		$(e).find('.battle_no').text(i + 1);
		if (i > 0) $(e).addClass('d-none');

		$(e).find('.custom-control-input').attr('id', 'grand_' + i);
		$(e).find('.custom-control-label').attr('for', 'grand_' + i);
	});

	// 戦闘回数初期化
	$('#battle_count').val(1);

	// 結果欄チェック初期化
	$('#display_bar').prop('checked', true);
	$('#display_land_base_result').prop('checked', true);
	$('#display_fleet_result').prop('checked', true);
	$('#display_enemy_table').prop('checked', true);

	// 熟練度非活性
	$('.remodel_select').prop('disabled', true);

	// 結果表示バー複製
	$('.progress_area').html($('.progress_area:first').html());
	$('.progress_area').each((i, e) => {
		$(e).find('.result_bar').attr('id', 'result_bar_' + (i + 1));
		if (i < 6) $(e).find('.progress_label').text(`基地${(Math.floor(i / 2) + 1)} ${((i % 2) + 1)}波目`);
		if (i === 6) $(e).find('.progress_label').text('本隊');
		if (i === 7) $(e).find('.progress_label').text('防空');
	});

	// 撃墜テーブルヘッダフッタ10戦分生成
	text = '';
	let text1 = '';
	let text2 = '';
	let text3 = '';
	for (let index = 1; index <= 10; index++) {
		text += `<td class="td_battle battle${index}">${index}戦目</td>`;
		text1 += `<td class="td_battle battle${index} fap"></td>`;
		text2 += `<td class="td_battle battle${index} eap"></td>`;
		text3 += `<td class="td_battle battle${index} cond"></td>`;
	}
	$('#shoot_down_table').find('.tr_header').append(text + '<td class="td_battle battle_end">出撃後</td><td class="td_battle battle_death">全滅率</td>');
	$('.tr_fap').append(text1 + '<td class="td_battle battle_end fap font_size_11" colspan="2"></td>');
	$('.tr_eap').append(text2 + '<td class="td_battle battle_end eap" rowspan="2" colspan="2"></td>');
	$('.tr_cond').append(text3);

	// 戦闘結果表示タブ10戦分生成
	text = '';
	for (let index = 1; index <= 10; index++) {
		text += `
			<li class="nav-item ${index === 1 ? '' : 'd-none'}">
				<a class="nav-link ${mainColor === '#000000' ? '' : 'nav-link-dark'} ${index === 1 ? 'active' : ''}" data-toggle="tab" data-disp="${index}" href="#">${index}戦目</a>
			</li>`;
	}
	$('#display_battle_tab').html(text);

	// 制空状態割合テーブル複製
	text = $('#rate_table').find('thead').html();
	for (let index = 0; index <= 7; index++) $('#rate_table tbody').append(text);
	$('#rate_table tbody').find('tr').each((i, e) => {
		const lb_num = Math.floor(i / 2) + 1;
		const wave = i % 2 + 1;
		$(e).attr('id', 'rate_row_' + (i + 1));
		if (i < 6) {
			// 基地部分
			$(e).find('.rate_td_name').html(`<span class="mr-1">基地${lb_num}</span><span class="text-nowrap">${wave}波目</span>`);
			$(e)[0].dataset.base_no = lb_num - 1;
			$(e).addClass('cur_pointer land_base_detail');
		}
		else if (i === 6) $(e).find('.rate_td_name').text('本隊');
		else if (i === 7) $(e).find('.rate_td_name').text('防空');

		if (i % 2 === 0) $(e).addClass('rate_tr_border_top');
		else if (i >= 6) $(e).addClass('rate_tr_border_top rate_tr_border_bottom');
	});

	// 詳細設定 初期熟練度欄複製
	text = $('#init_prof_parent').html();
	const types = PLANE_TYPE.filter(v => v.id > 0 && v.id !== 104);
	for (const type of types) {
		$('#init_prof_parent').append(text);
		const $last = $('#init_prof_parent').find('.type_name:last');
		$last.text(type.abbr);
		$last.closest('.init_prof')[0].dataset.typeid = type.id;
	}
	$('#init_prof_parent').find('.init_prof:first').remove();

	for (const v of setting.defaultProf) {
		proficiency_Changed($('.init_prof[data-typeid="' + v.id + '"').find('.prof_opt[data-prof="' + v.prof + '"]').parent(), true);
	}

	// コンテンツ順序復帰
	if (setting.contentsOrder.length) {
		const $main = $('#main');
		// いったん退避し削除
		const ids = [];
		let appendedIds = [];
		const contents = [];
		const lis = [];
		// フッター退避
		const footer = $('#main_footer');
		$main.find('.contents').each((i, e) => {
			ids.push($(e).attr('id'));
			contents.push($(e))
		});
		$main.empty();

		// でてきたid順にアペンド
		for (const id of setting.contentsOrder) {
			if (ids.includes(id)) {
				const $content = contents.find($e => $e.attr('id') === id);
				$main.append($content);

				// 挿入されたidは消化
				appendedIds.push(id);
			}
		}

		// フッター戻し
		$main.append(footer);

		// 挿入されていないコンテンツを拾い、setting.contentsOrderを修正
		if (ids.length !== appendedIds.length) {
			for (const id of ids) {
				if (!appendedIds.includes(id)) {
					const $content = contents.find($e => $e.attr('id') === id);
					$main.append($content);

					appendedIds.push(id);
				}
			}
			setting.contentsOrder = appendedIds.concat();
			saveSetting();
		}
	}

	$('#stage2_detail_slot').val(18);
	$('#stage2_detail_avoid').val(0);

	// シミュレート回数
	if (setting.simulateCount) $('#calculate_count').val(setting.simulateCount);
	else $('#calculate_count').val(5000);

	// 内部熟練度120
	if (setting.initialProf120) {
		initialProf120Plane = setting.initialProf120;
	}
	for (const type of initialProf120Plane) {
		$('#prof120_' + type).prop('checked', true);
	}

	// 表示形式(一列/複数列)
	if (setting.displayMode) {
		Object.keys(setting.displayMode).forEach((key) => {
			$(`#${key} .toggle_display_type[data-mode="${setting.displayMode[key]}"]`).addClass('selected');
		});
	}
	else $('.toggle_display_type[data-mode="single"]').addClass('selected');

	// 対空CIプルダウン初期化
	text = '<option value="0">不発</option>';
	text1 = '';
	for (const s of ANTIAIR_CUTIN) {
		const none = setting.invisibleCutin && setting.invisibleCutin.includes(s.id);
		text += `<option value="${s.id}" ${none ? 'class="d-none"' : ''}>${s.name}（変動: ${s.adj[0]} 固定: ${s.adj[1]})</option>`;
		text1 += `
		<div class="d-flex general_tr py-1 px-2 cutin_visible ${none ? 'disabled' : ''}" data-cutinid="${s.id}">
			<div class="w_5 text-center"><i class="fas fa-eye${none ? '-slash' : ''}"></i></div>
			<div class="w_10 text-center">${s.name}</div>
			<div class="w_55">${s.remarks}</div>
			<div class="w_15 text-center">${s.adj[0]}</div>
			<div class="w_15 text-center">${s.adj[1]}</div>
		</div>`;
	}
	$('.select_antiair_cutin_td').html(text);
	$('#antiair_cutin_settings').html(text1);

	// 連合艦隊チェック初期化
	$('#union_fleet').prop('checked', setting.isUnion);
	// クリップボード保存
	$('#clipboard_mode').prop('checked', setting.copyToClipboard);
	// 空スロット表示
	$('#empty_slot_invisible').prop('checked', setting.emptySlotInvisible);
	// お気に入りのみ表示
	$('#fav_only').prop('checked', setting.favoriteOnly);
	$('#fav_only_ship').prop('checked', setting.favoriteOnlyShip);
	// 在庫有のみ表示
	$('#disp_in_stock').prop('checked', setting.inStockOnly);
	$('#divide_stock').prop('checked', setting.isDivideStock);
	$('#disp_in_stock_ship').prop('checked', setting.inStockOnlyShip);
	// 配備済み表示
	$('#disp_equipped').prop('checked', setting.visibleEquipped);
	$('#disp_equipped_ship').prop('checked', setting.visibleEquippedShip);
	// 敵艦表示形式
	$('#enemy_display_image').prop('checked', setting.enemyDisplayImage);
	// 敵艦表示形式
	$('#enemy_display_text').prop('checked', !setting.enemyDisplayImage);
	// 敵艦表示形式 敵艦隊欄
	$('#enemy_fleet_display_image').prop('checked', setting.enemyFleetDisplayImage);
	// 敵艦表示形式 敵艦隊欄
	$('#enemy_fleet_display_text').prop('checked', !setting.enemyFleetDisplayImage);
	// マップ難易度初期化
	$('#select_difficulty').val(4);
	$('#plane_word').val('');
	$('#ship_word').val('');
	$('#enemy_word').val('');
	$('#stock_word').val('');

	// おまかせ配備初期選択
	$('#modal_auto_expand').find('.custom-control-input').prop('checked', false);
	$('#btn_start_auto_expand').prop('disabled', true);
	$('#mode_1').prop('checked', true);
	$('#dest_ap').val(100);
	$('#dest_range').val(6);

	// 基地欄タブ化するかどうか
	if ($('#lb_tab_select').css('display') !== 'none' && !$('#lb_item1').attr('class').includes('tab-pane')) {
		$('.lb_tab').addClass('tab-pane fade');
		$('.baseNo').removeClass('cur_move sortable_handle');
		$('.lb_tab:first').addClass('show active');
		$('#lb_item1').addClass('active');
	}

	// tooltip起動
	$('[data-toggle="tooltip"]').tooltip();

	// グラフグローバル解除
	Chart.plugins.unregister(ChartDataLabels);

	callback();
}

/**
 * 機体カテゴリselectタグに、第2引数配列からoptionタグを生成
 * @param {HTMLElement} element 設置する対象の select
 * @param {Array<number>} array 展開する機体カテゴリid配列
 */
function setPlaneType(element, array, withoutAll = false) {
	element.innerHTML = '';

	if (!withoutAll) {
		const optAll = document.createElement('option');
		optAll.value = '0';
		optAll.textContent = '全て';
		element.appendChild(optAll);
	}

	// 陸上機判定
	if (isContain(array, [100, 101, 102, 103, 104, 105])) {
		const opt = document.createElement('optgroup');
		opt.label = '陸上機';
		opt.className = 'optg_lb';
		element.appendChild(opt);
	}
	// 艦上機判定
	if (isContain(array, [1, 2, 3, 4, 9])) {
		const opt = document.createElement('optgroup');
		opt.label = '艦上機';
		opt.className = 'optg_cb';
		element.appendChild(opt);
	}
	// 水上機判定
	if (isContain(array, [5, 6, 7, 8])) {
		const opt = document.createElement('optgroup');
		opt.label = '水上機';
		opt.className = 'optg_sp';
		element.appendChild(opt);
	}
	for (const v of PLANE_TYPE) {
		if (array.includes(v.id)) {
			const opt = document.createElement('option');
			opt.value = v.id;
			opt.textContent = v.name;

			if ([1, 2, 3, 4, 9].includes(v.id)) {
				element.getElementsByClassName('optg_cb')[0].appendChild(opt);
			}
			else if ([5, 6, 7, 8].includes(v.id)) {
				element.getElementsByClassName('optg_sp')[0].appendChild(opt);
			}
			else {
				element.getElementsByClassName('optg_lb')[0].appendChild(opt);
			}
		}
	}
}

/**
 * 機体カテゴリタブを生成
 * @param {HTMLElement} element 設置する対象の ul
 * @param {Array<number>} array 展開する機体カテゴリid配列
 */
function setPlaneTypeIconSelect(element, array, withoutAll = false) {
	if (withoutAll) element.innerHTML = '';
	else {
		element.innerHTML = `
		<li class="nav-item">
			<a class="nav-link active" data-toggle="tab" data-type="0" href="#">
				<img src="../img/type/all.png" class="img-size-25" alt="全て">
			</a>
		</li>`;
	}

	const fragment = document.createDocumentFragment();
	const types = PLANE_TYPE.filter(v => ![6, 7, 8, 9, 104, 105].includes(v.id));

	const li = document.createElement('li');
	li.className = 'nav-item';

	for (const v of types) {
		if (array.includes(v.id)) {
			const li = document.createElement('li');
			li.className = 'nav-item';

			const a = document.createElement('a');
			a.href = '#';
			a.className = 'nav-link';
			a.dataset.toggle = 'tab';
			a.dataset.type = v.id;

			const img = document.createElement('img');
			img.classList = 'img-size-25';
			img.src = `../img/type/type${v.id}.png`;
			img.alt = v.name;

			a.appendChild(img);
			li.appendChild(a);

			fragment.appendChild(li);
		}
	}

	element.appendChild(fragment);
}

/**
 * 艦種selectタグに、第1引数配列からoptionタグを生成
 * @param {Array<number>} array 展開する艦種id配列
 */
function setShipType(array) {
	for (const v of SHIP_TYPE) {
		if (array.includes(v.id)) {
			const opt = document.createElement('option');
			opt.value = v.id;
			opt.textContent = v.name;
			document.getElementById('ship_type_select').appendChild(opt);

			const opt2 = document.createElement('option');
			opt2.value = v.id;
			opt2.textContent = v.name;
			document.getElementById('ship_stock_type_select').appendChild(opt2);
		}
	}
}

/**
 * 敵艦種selectタグに、第二引数配列からoptionタグを生成
 * @param {Array<number>} array 展開する艦種id配列
 */
function setEnemyType(array) {
	const parent1 = document.getElementById('enemy_type_select');
	for (const v of ENEMY_TYPE) {
		if (array.includes(v.id)) {
			const opt = document.createElement('option');
			opt.value = v.id;
			opt.textContent = v.name;
			parent1.appendChild(opt.cloneNode(true));
		}
	}
	parent1.options[2].selected = true;
}

/**
 * 引数で渡された .xx_plane 内艦載機データをクリアする
 * @param {JQuery} $div クリアする .lb_plane .ship_plane
 */
function clearPlaneDiv($div) {
	// 選択状況をリセット
	$div.removeClass(getPlaneCss($div[0].dataset.type));
	$div[0].dataset.planeid = '';
	$div[0].dataset.type = '';
	$div.find('.plane_img').attr('src', '../img/type/undefined.png').attr('alt', '');
	$div.find('.cur_move').removeClass('cur_move');
	$div.find('.drag_handle').removeClass('drag_handle');
	$div.find('.plane_name_span').text('機体を選択');
	$div.find('.remodel_select').prop('disabled', true).addClass('remodel_disabled');
	$div.find('.remodel_value').text(0);
	$div.find('.btn_remove_plane').addClass('opacity0');
	const $profSelect = $div.find('.prof_select');
	$profSelect.attr('src', '../img/util/prof0.png').attr('alt', '');
	$profSelect[0].dataset.prof = 0;
}
/**
 * 引数で渡された要素内の艦載機を全てクリアする
 * @param {JQuery} $div クリア対象 .contents または #landBase #friendFleet
 */
function clearPlaneDivAll($div) {
	if ($div.attr('id') === 'landBase') {
		$('.lb_plane').each((i, e) => setLBPlaneDiv($(e)));
		$('#modal_collectively_setting').modal('hide');
	}
	else if ($div.attr('id') === 'friendFleet') {
		$('.ship_plane').each((i, e) => clearPlaneDiv($(e)));
	}
}

/**
 * 第1引数で渡された lb_plane要素 に対し第2引数の機体オブジェクト（{id, prof, slot, remodel} 指定）を挿入する
 * @param {JQuery} $div 挿入先
 * @param {Object} lbPlane 機体データオブジェクト データがない場合はClear処理として動作
 */
function setLBPlaneDiv($div, lbPlane = { id: 0, slot: 0, remodel: 0 }) {
	const id = castInt(lbPlane.id);
	const plane = PLANE_DATA.find(v => v.id === id);
	const result = setPlaneDiv($div, lbPlane);
	if (!lbPlane.hasOwnProperty('slot')) lbPlane.slot = 0;

	// 搭載数最大値　基本は18
	let maxSlot = 18;
	if (result && plane) {
		if (RECONNAISSANCES.includes(plane.type)) maxSlot = 4;
		else if (plane.type === 105) maxSlot = 9;
	}
	$div.find('.slot_input').attr('max', maxSlot);
	$div.find('.slot_range').attr('max', maxSlot);

	let initSlot = lbPlane.slot;
	if (initSlot === 0 || initSlot > maxSlot) initSlot = maxSlot;
	if (!result) initSlot = 0;

	$div.find('.slot').text(initSlot);
}

/**
 * 第1引数で渡された xx_plane に第2引数の機体オブジェクト（{id, prof, remodel} 指定）を搭載する
 * @param {JQuery} $div xx_planeを指定。xxは現状 ship または lb
 * @param {Object} inputPlane 機体オブジェクト（{id, prof, remodel} 指定）
 * @param {boolean} canEditSlot 搭載数の変更を許可するかどうか
 * @returns {boolean} 搭載が成功したかどうか
 */
function setPlaneDiv($div, inputPlane = { id: 0, remodel: 0, prof: -1 }, canEditSlot = false) {
	// 機体じゃなさそうなモノが渡されたらとりあえずクリア
	if (!inputPlane.id) {
		clearPlaneDiv($div);
		return false;
	}

	// 渡された機体の基本データ取得
	const plane = PLANE_DATA.find(v => v.id === inputPlane.id);
	// 未定義の機体だった場合もクリア
	if (!plane) {
		clearPlaneDiv($div);
		return false;
	}

	// 渡された機体の不足プロパティセット
	if (!inputPlane.hasOwnProperty('remodel')) inputPlane.remodel = 0;
	if (!inputPlane.hasOwnProperty('prof')) inputPlane.prof = -1;

	if ($div.closest('.ship_tab').length > 0) {
		// 搭載先が艦娘の場合、機体が装備できるのかどうかチェック
		let shipId = castInt($div.closest('.ship_tab')[0].dataset.shipid);
		if (!checkInvalidPlane(shipId, plane)) {
			clearPlaneDiv($div);
			return false;
		}

		// 日進の大型飛行艇処理
		if (plane.type === 8 && (shipId === 1490 || shipId === 386)) {
			if (inputPlane.hasOwnProperty('slot')) inputPlane.slot = 1;
			else inputPlane["slot"] = 1;
			canEditSlot = true;
		}
	}

	$div.removeClass(getPlaneCss($div[0].dataset.type)).addClass(getPlaneCss(plane.type));
	$div[0].dataset.planeid = plane.id;
	$div[0].dataset.type = plane.type;
	$div.find('.plane_name_span').text(plane.abbr ? plane.abbr : plane.name).attr('title', plane.abbr ? plane.name : '');
	$div.find('.plane_img').attr('src', `../img/type/type${plane.type}.png`).attr('alt', plane.type);
	$div.find('.plane_img').parent().addClass('cur_move drag_handle');
	$div.find('.plane_name').addClass('drag_handle');
	$div.find('.btn_remove_plane').removeClass('opacity0');

	// 改修の有効無効設定
	const $remodelInput = $div.find('.remodel_select');
	$remodelInput.prop('disabled', !plane.canRemodel)
	if (!plane.canRemodel) {
		// 改修無効の機体
		$remodelInput.addClass('remodel_disabled');
		$remodelInput.find('.remodel_value').text(0);
	}
	else {
		// 改修値セット 基本は0
		$remodelInput.removeClass('remodel_disabled');
		$remodelInput.find('.remodel_value').text(Math.min(inputPlane.remodel, 10));
	}

	// 熟練度初期値 陸偵熟練は||
	let prof = 0;
	// デフォルト熟練度
	let tmpDefault = setting.defaultProf.find(v => v.id === Math.abs(plane.type));
	if (tmpDefault) prof = tmpDefault.prof;
	if (plane.id === 312) prof = 2;
	// 特定熟練度を保持していた場合
	if (inputPlane.prof >= 0) prof = inputPlane.prof;
	const $prof_select = $div.find('.prof_select');
	$prof_select.attr('src', `../img/util/prof${prof}.png`);
	$prof_select[0].dataset.prof = prof;

	// 搭載数を変更する
	if (canEditSlot) {
		if (!inputPlane.hasOwnProperty('slot')) inputPlane.slot = 0;
		$div.find('.slot').text(inputPlane.slot);
	}

	// 搭載成功
	return true;
}

/**
 * 第1引数で渡された .ship_tab に第2引数で渡された 艦娘データを挿入する
 * @param {JQuery} $div 艦娘タブ (.ship_tab)
 * @param {number} id 艦娘id
 */
function setShipDiv($div, id) {
	const ship = SHIP_DATA.find(v => v.id === id);
	if (!ship) return;
	$div[0].dataset.shipid = ship.id;
	$div.find('.ship_img').attr('src', `../img/ship/${id}.png`);
	$div.find('.sortable_handle').removeClass('d-none');
	$div.find('.ship_name_span').text(ship.name);
	$div.find('.ship_plane').each((i, e) => {
		const $this = $(e);
		const plane = {
			id: castInt($this[0].dataset.planeid),
			remodel: castInt($this.find('.remodel_value').text()),
			prof: castInt($this.find('.prof_select')[0].dataset.prof),
		};
		// 既に装備されている装備を装備しなおそうとする -> 不適切なら自動的にはずれる
		if ($div[0].dataset.shipid) setPlaneDiv($this, plane);

		if (i < ship.slot.length) {
			$this.removeClass('d-none').addClass('d-flex');
			$this.find('.slot').text(ship.slot[i]);
			$this.find('.slot_select_parent').data('ini', ship.slot[i]);
		}
		else {
			clearPlaneDiv($this);
			$this.removeClass('d-flex').addClass('d-none');
			$this.find('.slot').text(0);
			$this.find('.slot_select_parent').data('ini', 0);
		}
	});
}

/**
 * 指定した ship_tab をクリアする
 * @param {JQuery} $div クリアする .ship_tab
 */
function clearShipDiv($div) {
	// 選択状況をリセット
	$div[0].dataset.shipid = '';
	$div.find('.sortable_handle').addClass('d-none');
	$div.find('.ship_img').attr('src', '../img/ship/0.png');
	$div.find('.ship_name_span').text('艦娘を選択');
	$div.find('.ship_plane').each((i, e) => {
		const $this = $(e);
		clearPlaneDiv($this);
		$this.find('.slot').text(0);
		$this.find('.slot_input').attr('max', 99);
		$this.find('.slot_range').attr('max', 99);
		if (i < 4) $this.removeClass('d-none').addClass('d-flex');
		else $this.removeClass('d-flex').addClass('d-none');
	});
}

/**
 * 艦娘を全て解除する。表示隻数も変更する
 * @param {number} displayCount 表示隻数　デフォルト2
 */
function clearShipDivAll(displayCount = 2) {
	$('.ship_tab').each((i, e) => clearShipDiv($(e)));
	$('.display_ship_count').each((i, e) => {
		$(e).val(displayCount);
		display_ship_count_Changed($(e), true);
	});
}

/**
 * 第1引数で渡された .enemy_content に第2引数で渡されたidの敵艦データを挿入する
 * @param {JQuery} $div 敵艦タブ (enemy_content)
 * @param {number} id 敵艦id
 * @param {number} ap 直接入力時指定(id === -1時)
 */
function setEnemyDiv($div, id, ap = 0) {
	if (!$div) return;
	const enemy = new Enemy(id);
	const displayText = !setting.enemyFleetDisplayImage;

	// 空の敵艦が帰ってきたら中止
	if (enemy.id === 0) return;

	$div[0].dataset.enemyid = enemy.id;
	$div.removeClass('d-none no_enemy').addClass('d-flex');
	$div.find('.enemy_name_text').html(drawEnemyGradeColor(enemy.name));
	$div.find('.enemy_name_img').attr('src', `../img/enemy/${enemy.id}.png`);

	if (displayText) {
		$div.addClass('py-0_5').removeClass('pb-0_1 min-h-31px');
		$div.find('.enemy_name_img_parent').addClass('d-none').removeClass('d-flex');
		$div.find('.enemy_name_text').removeClass('d-none');
	}
	else {
		$div.removeClass('py-0_5').addClass('pb-0_1 min-h-31px');
		$div.find('.enemy_name_img_parent').addClass('d-flex').removeClass('d-none');
		$div.find('.enemy_name_text').addClass('d-none');
	}

	let displayAp = 0;
	if (id === -1 && ap > 0) displayAp = ap;
	else if (enemy.airPower > 0) displayAp = enemy.airPower;
	else if (enemy.landBaseAirPower > 0) displayAp = `(${enemy.landBaseAirPower})`;
	$div.find('.enemy_ap').text(displayAp);
}

/**
 * 指定した enemy_content をクリアする
 * @param {JQuery} $div クリアする .enemy_content
 */
function clearEnemyDiv($div) {
	$div[0].dataset.enemyid = 0;
	$div.addClass('no_enemy');
	$div.addClass('py-0_5').removeClass('pb-0_1 min-h-31px');
	$div.find('.enemy_name_img_parent').addClass('d-none').removeClass('d-flex');
	$div.find('.enemy_name_img').attr('src', `../img/enemy/-1.png`);
	$div.find('.enemy_name_text').removeClass('d-none');
	$div.find('.enemy_name_text').text('敵艦を選択');
	$div.find('.enemy_ap').text(0);
}

/**
 * 全敵艦解除 戦闘数も変更(指定可能 デフォルト1)
 * @param {number} count 初期戦闘数 デフォルト1
 */
function clearEnemyDivAll(count = 1) {
	$('.battle_content').each((i, e) => {
		$(e)[0].dataset.celldata = '';
		$(e).find('.enemy_content').each((i, e) => clearEnemyDiv($(e)));
	});
	$('#battle_count').val(count);
	createEnemyInput(count);

	clearEnemyDiv($('#air_raid_enemies').find('.enemy_content'));
}

/**
 * 値が増加した場合緑に、減少した場合赤に、色を変えつつ値を変更する
 * @param {Element} node
 * @param {number} pre 変更前の値
 * @param {number} cur 変更後の値
 * @param {boolean} reverse 赤緑判定を反転する場合 true を指定
 */
function drawChangeValue(node, pre, cur, reverse = false) {
	if (castInt(pre) !== castInt(cur)) {
		const $inline = $(node);
		$inline.text(cur).stop();
		if (reverse) $inline.css('color', cur < pre ? '#0c5' : cur > pre ? '#f00' : mainColor);
		else $inline.css('color', cur > pre ? '#0c5' : cur < pre ? '#f00' : mainColor);
		$inline.delay(500).animate({ 'color': mainColor }, 1000);
	}
	else $(node).css('color', mainColor);
}

/**
 * 渡された敵艦名にflagshipやelite文字が含まれていれば色を塗ったspanのHtmlTextとして返却
 * @param {string} enemyName
 * @returns {string} 色付き敵艦名
 */
function drawEnemyGradeColor(enemyName) {
	if (enemyName.includes('elite')) {
		enemyName = enemyName.replace('elite', '<span class="text-danger">elite</span>');
	}
	else if (enemyName.includes('改flagship')) {
		enemyName = enemyName.replace('flagship', '<span class="text-primary">flagship</span>');
	}
	else if (enemyName.includes('flagship')) {
		enemyName = enemyName.replace('flagship', '<span class="text-warning">flagship</span>');
	}
	return enemyName;
}

/**
 * 機体一覧に plans 配列から値を展開
 * @param {Array.<Object>} planes
 */
function createPlaneTable(planes) {
	const $modal = $('#modal_plane_select').find('.modal-dialog');
	const $tbody = $('#plane_tbody');
	const target = document.getElementById('plane_tbody');
	const fragment = document.createDocumentFragment();
	const imgWidth = 25;
	const imgHeight = 25;
	const displayMode = $modal.find('.toggle_display_type.selected').data('mode');
	const planeStock = loadPlaneStock();
	const dispInStock = setting.inStockOnly;
	const isDivideStock = setting.isDivideStock;
	const dispEquipped = setting.visibleEquipped;
	const favOnly = setting.favoriteOnly;
	const sortKey = $('#plane_sort_select').val();
	const usedTable = usedPlane.concat();

	if (displayMode === "multi") {
		$modal.addClass('modal-xl');
		$tbody.addClass('multi_mode');
		$tbody.prev().addClass('d-none').removeClass('d-flex');
	}
	else {
		$modal.removeClass('modal-xl');
		$tbody.removeClass('multi_mode');
		$tbody.prev().addClass('d-flex').removeClass('d-none');
	}

	if (dispInStock) {
		$('#divide_stock').closest('div').removeClass('d-none');
		$('#disp_equipped').closest('div').removeClass('d-none');
		$('#disp_in_stock').prop('checked', true);
	}
	else {
		$('#divide_stock').closest('div').addClass('d-none');
		$('#disp_equipped').closest('div').addClass('d-none');
		$('#disp_in_stock').prop('checked', false);
	}

	const max_i = planes.length;
	let prevType = 0;
	let maxRemodelLevel = 0;
	let enabledCount = -1;
	let stockNumber = 0;

	for (let i = 0; i < max_i; i++) {
		const plane = planes[i];
		const nmAA = plane.antiAir + 1.5 * plane.interception;
		const defAA = plane.antiAir + plane.interception + 2.0 * plane.antiBomber;

		// お気に入り機体のみ
		if (favOnly && !setting.favoritePlane.includes(plane.id)) continue;

		// 使用済み機体チェック
		if (dispInStock && planeStock) {
			// 使用済み機体 [id: , remodels: [1, 0, 1, ...]]
			const used = usedTable.find(v => v.id === plane.id);

			if (isDivideStock) {
				enabledCount = plane.count - (used ? used.num[plane.remodel] : 0);
				if (!dispEquipped && enabledCount < 1) continue;
				// クリック時に搭載する改修値の設定
				maxRemodelLevel = plane.remodel;
			}
			else {
				const stock = planeStock.find(v => v.id === plane.id);
				// 使用済み数
				const usedNum = used ? getArraySum(used.num) : 0;
				// 初期所持数
				stockNumber = stock ? getArraySum(stock.num) : 0;
				// 未所持 または 全て配備済みかつ配備済みは非表示 の場合表示しない
				if (stockNumber <= 0 || (!dispEquipped && usedNum >= stockNumber)) continue;
				// 利用可能数
				enabledCount = stockNumber - usedNum;
				for (let j = 10; j >= 0; j--) {
					if (used) stock.num[j] -= used.num[j];
					if (stock.num[j] > 0) {
						maxRemodelLevel = j;
						break;
					}
				}
			}
		}

		// ラップ
		const $planeDiv = document.createElement('div');
		$planeDiv.className = `plane plane_tr general_tr d-flex py-2 py-lg-1${displayMode === "multi" ? ' tr_multi' : ''}`;
		$planeDiv.dataset.planeid = plane.id;
		$planeDiv.dataset.type = plane.type;
		$planeDiv.dataset.remodel = maxRemodelLevel;
		if (dispInStock && dispEquipped && enabledCount <= 0) {
			$planeDiv.classList.remove('plane_tr', 'plane', 'general_tr');
			$planeDiv.classList.add('plane_tr_disabled');
		}

		// アイコン用ラッパー
		const $iconDiv = document.createElement('div');
		$iconDiv.className = 'align-self-center size-25';

		// アイコン
		const cvs = document.createElement('canvas');
		const ctx = cvs.getContext('2d');
		cvs.width = imgWidth;
		cvs.height = imgHeight;
		ctx.drawImage(IMAGES['type' + plane.type], 0, 0, imgWidth, imgHeight);

		// 機体名
		const $nameDiv = document.createElement('div');
		$nameDiv.className = 'pl-1 plane_td_name align-self-center';
		$nameDiv.textContent = plane.name;

		// 残り個数
		const $stockDiv = document.createElement('div');
		$stockDiv.className = 'ml-1 plane_td_stock align-self-center';
		$stockDiv.textContent = '×' + (enabledCount > 0 ? enabledCount : 0);

		// 対空
		const $aaDiv = document.createElement('div');
		$aaDiv.className = 'ml-auto plane_td_basic align-self-center';

		// 対空の表示トグル
		switch (sortKey) {
			case 'battle_anti_air':
				$aaDiv.textContent = nmAA % 1 ? nmAA.toFixed(1) : nmAA;
				break;
			case 'defense_anti_air':
				$aaDiv.textContent = defAA % 1 ? defAA.toFixed(1) : defAA;
				break;
			default:
				$aaDiv.textContent = plane.antiAir % 1 ? plane.antiAir.toFixed(1) : plane.antiAir;
				break;
		}

		// 半径
		const $rangeDiv = document.createElement('div');
		$rangeDiv.className = 'plane_td_basic align-self-center';
		$rangeDiv.textContent = plane.radius;

		// 複数表示時分割
		if (displayMode === "multi" && prevType !== plane.type && sortKey === 'default') {
			const $typeDiv = document.createElement('div');
			$typeDiv.className = 'type_divider mt-3 mb-1';

			const $type = document.createElement('div');
			$type.className = 'font_size_12 font_color_half align-self-center';
			$type.textContent = PLANE_TYPE.find(v => v.id === plane.type).name;

			const $typeLine = document.createElement('div');
			$typeLine.className = 'flex-grow-1 border-bottom align-self-center mx-2';

			$typeDiv.appendChild($type);
			$typeDiv.appendChild($typeLine);

			fragment.appendChild($typeDiv);
		}

		$iconDiv.appendChild(cvs);
		$planeDiv.appendChild($iconDiv);
		$planeDiv.appendChild($nameDiv);
		if (isDivideStock && plane.remodel > 0) {
			// 改修値
			const $remodelDiv = document.createElement('div');
			$remodelDiv.className = 'ml-1 plane_td_remodel align-self-center';
			$remodelDiv.dataset.remodel = plane.remodel;
			$remodelDiv.textContent = plane.remodel < 10 ? '★+' + plane.remodel : '★MAX';
			$planeDiv.appendChild($remodelDiv);
			$planeDiv.appendChild($stockDiv);
		}

		// 所持数突っ込む
		if (enabledCount > 0) {
			$planeDiv.appendChild($stockDiv);
		}

		if (displayMode === "single") {
			$planeDiv.appendChild($aaDiv);
			$planeDiv.appendChild($rangeDiv);
		}

		fragment.appendChild($planeDiv);
		prevType = plane.type;
	}

	target.innerHTML = '';
	target.appendChild(fragment);
}

/**
 * 艦載機ドラッグボックス初期化
 */
function createDraggablePlaneTable($this = null) {
	if (!$this) $this = $('#draggable_plane_type_select').find('.active');
	if (!$this.length) {
		$('#draggable_plane_type_select').find('.nav-link:first').addClass('active');
	}
	const type = castInt($this.length ? $this[0].dataset.type : 1);
	let planes = PLANE_DATA.filter(v => Math.abs(v.type) === type);
	const target = document.getElementById('draggable_plane_tbody');
	const fragment = document.createDocumentFragment();
	const imgWidth = 25;
	const imgHeight = 25;
	const planeStock = loadPlaneStock();
	const dispInStock = setting.inStockOnly;
	const isDivideStock = setting.isDivideStock;
	const dispEquipped = setting.visibleEquipped;
	const favOnly = setting.favoriteOnly;
	const max_i = planes.length;
	const usedTable = usedPlane.concat();
	let maxRemodelLevel = 0;
	let enabledCount = -1;
	let stockNumber = 0;

	// 個別表示対応
	if (setting.inStockOnly && setting.isDivideStock) {
		// 所持数ロード
		const stock = loadPlaneStock();
		const newPlanes = [];
		// 既存品ベースに所持品検索
		for (const o of planes) {
			const x = stock.find(v => v.id === o.id);
			for (let i = 0; i <= 10; i++) {
				const stockCount = x.num[i];
				if (stockCount === 0) continue;
				const plane = Object.assign({ remodel: i, count: stockCount }, o);
				plane.antiAir = Plane.getBonusAntiAir(plane.id, plane.type, plane.remodel, plane.antiAir);
				newPlanes.push(plane);
			}
		}
		planes = newPlanes.concat();
	}

	// ソート反映
	const sortKey = $('#draggable_plane_sort_select').val();
	switch (sortKey) {
		case 'battle_anti_air':
			planes.sort((a, b) => (b.antiAir + 1.5 * b.interception) - (a.antiAir + 1.5 * a.interception));
			break;
		case 'defense_anti_air':
			planes.sort((a, b) => (b.antiAir + b.interception + 2.0 * b.antiBomber) - (a.antiAir + a.interception + 2.0 * a.antiBomber));
			break;
		case 'land_base_power':
			planes.sort((a, b) => getLandBasePower(b.id, 18, 0) - getLandBasePower(a.id, 18, 0));
			break;
		case 'radius':
			planes.sort((a, b) => b.radius - a.radius);
			break;
		case 'history':
			if (setting.selectedHistory[0]) {
				const lst = setting.selectedHistory[0];
				planes.sort((a, b) => lst.filter(v => v === b.id).length - lst.filter(v => v === a.id).length);
			}
		case 'default':
			break;
		default:
			planes.sort((a, b) => b[sortKey] - a[sortKey]);
			break;
	}

	for (let i = 0; i < max_i; i++) {
		const plane = planes[i];
		const nmAA = plane.antiAir + 1.5 * plane.interception;
		const defAA = plane.antiAir + plane.interception + 2.0 * plane.antiBomber;
		const needTooltip = plane.antiBomber > 0 || plane.interception > 0;

		// お気に入り機体のみ
		if (favOnly && !setting.favoritePlane.includes(plane.id)) continue;

		// 使用済み機体チェック
		if (dispInStock && planeStock) {
			// 使用済み機体 [id: , remodels: [1, 0, 1, ...]]
			const used = usedTable.find(v => v.id === plane.id);

			if (isDivideStock) {
				// この機体を利用しているかどうか
				enabledCount = plane.count - (used ? used.num[plane.remodel] : 0);
				if (enabledCount < 1) continue;
				// クリック時に搭載する改修値の設定
				maxRemodelLevel = plane.remodel;
			}
			else {
				const stock = planeStock.find(v => v.id === plane.id);
				// 使用済み数
				const usedNum = used ? getArraySum(used.num) : 0;
				// 初期所持数
				stockNumber = stock ? getArraySum(stock.num) : 0;
				// 未所持 または 全て配備済みかつ配備済みは非表示 の場合表示しない
				if (stockNumber <= 0 || (!dispEquipped && usedNum >= stockNumber)) continue;
				// 利用可能数
				enabledCount = stockNumber - usedNum;
				for (let j = 10; j >= 0; j--) {
					if (used) stock.num[j] -= used.num[j];
					if (stock.num[j] > 0) {
						maxRemodelLevel = j;
						break;
					}
				}
			}
		}

		// ラップ
		const $planeDiv = document.createElement('div');
		$planeDiv.className = `plane plane_tr_draggable d-flex py-2 py-lg-1`;
		$planeDiv.dataset.planeid = plane.id;
		$planeDiv.dataset.type = plane.type;
		$planeDiv.dataset.abbr = plane.name;
		$planeDiv.dataset.remodel = maxRemodelLevel;
		if (dispInStock && dispEquipped && enabledCount <= 0) {
			$planeDiv.classList.remove('plane_tr_draggable', 'plane');
			$planeDiv.classList.add('plane_tr_disabled');
		}

		// アイコン用ラッパー
		const $iconDiv = document.createElement('div');
		$iconDiv.className = 'align-self-center size-25';

		// アイコン
		const cvs = document.createElement('canvas');
		const ctx = cvs.getContext('2d');
		cvs.width = imgWidth;
		cvs.height = imgHeight;
		ctx.drawImage(IMAGES['type' + plane.type], 0, 0, imgWidth, imgHeight);

		// 機体名
		const $nameDiv = document.createElement('div');
		$nameDiv.className = 'pl-1 plane_td_name align-self-center';
		$nameDiv.textContent = plane.name;

		// 残り個数
		const $stockDiv = document.createElement('div');
		$stockDiv.className = 'ml-1 plane_td_stock align-self-center';
		$stockDiv.textContent = '×' + (enabledCount >= 0 ? enabledCount : 0);

		// 対空
		const $aaDiv = document.createElement('div');
		$aaDiv.className = 'ml-auto plane_td_basic align-self-center ' + (needTooltip ? 'text_existTooltip' : '');
		if (needTooltip) {
			$aaDiv.dataset.toggle = 'tooltip';
			$aaDiv.title = '出撃時:' + nmAA + ' , 防空時:' + defAA;
		}
		// 対空の表示トグル
		switch (sortKey) {
			case 'battle_anti_air':
				$aaDiv.textContent = nmAA % 1 ? nmAA.toFixed(1) : nmAA;
				break;
			case 'defense_anti_air':
				$aaDiv.textContent = defAA % 1 ? defAA.toFixed(1) : defAA;
				break;
			default:
				$aaDiv.textContent = plane.antiAir % 1 ? plane.antiAir.toFixed(1) : plane.antiAir;
				break;
		}

		// 半径
		const $rangeDiv = document.createElement('div');
		$rangeDiv.className = 'plane_td_basic align-self-center';
		$rangeDiv.textContent = plane.radius;

		$iconDiv.appendChild(cvs);
		$planeDiv.appendChild($iconDiv);
		$planeDiv.appendChild($nameDiv);
		if (isDivideStock && plane.remodel > 0) {
			// 改修値
			const $remodelDiv = document.createElement('div');
			$remodelDiv.className = 'ml-1 plane_td_remodel align-self-center';
			$remodelDiv.dataset.remodel = plane.remodel;
			$remodelDiv.textContent = plane.remodel < 10 ? '★+' + plane.remodel : '★MAX';
			$planeDiv.appendChild($remodelDiv);
		}
		if (enabledCount > 0) {
			$planeDiv.appendChild($stockDiv);
		}

		$planeDiv.appendChild($aaDiv);
		$planeDiv.appendChild($rangeDiv);

		fragment.appendChild($planeDiv);
	}

	target.innerHTML = '';
	target.appendChild(fragment);

	$('.plane_tr_draggable').draggable({
		helper: 'clone',
		zIndex: 1000,
		start: function (e, ui) {
			const html = `
			<div>
				<img src="../img/type/type${$(this)[0].dataset.type}.png" width="25", height="25">
				<span class="ml-1">${$(this)[0].dataset.abbr}</span>
			</div>`
			$(ui.helper).css('width', '380px');
			$(ui.helper).html(html);
		}
	});

	$(target).find('.text_existTooltip').tooltip();
	$('#draggable_plane_box').removeClass('d-none');
}

/**
 * 所持艦娘テーブル読み込み
 */
function setShipStockTable() {
	const target = document.getElementById('ship_stock_tbody');
	const fragment = document.createDocumentFragment();
	const imgWidth = 100;
	const imgHeight = 25;
	const ships = SHIP_DATA.filter(v => v.id > 0);
	const shipStock = loadShipStock();

	const max_i = ships.length;
	for (let i = 0; i < max_i; i++) {
		const ship = ships[i];
		const stock = shipStock.find(v => v.id === ship.id);

		// ラップ
		const $shipDiv = document.createElement('div');
		$shipDiv.className = `stock_tr general_tr py-1 d-flex type_` + ship.type;
		$shipDiv.dataset.shipid = ship.id;

		// 図鑑
		const $album = document.createElement('div');
		$album.className = 'stock_td_id font_size_14 align-self-center font_size_12';
		$album.textContent = ship.id;

		// アイコン用ラッパー
		const $iconDiv = document.createElement('div');
		$iconDiv.className = 'stock_td_name align-self-center flex-grow-1 text-left';

		// アイコン
		const $img = document.createElement('img');
		$img.width = imgWidth;
		$img.height = imgHeight;
		$img.src = '../img/ship/' + ship.id + '.png';
		$iconDiv.appendChild($img);

		// 艦娘名
		const $name = document.createElement('span');
		$name.className = 'ml-1 stock_td_name font_size_14';
		$name.textContent = ship.name;
		$iconDiv.appendChild($name);

		// お気に入り
		const $favDiv = document.createElement('div');
		$favDiv.className = `stock_td_fav font_size_18 align-self-center ${setting.favoriteShip.includes(ship.id) ? 'stock_fav' : 'stock_unfav'}`;
		const $fav = document.createElement('i');
		$fav.className = 'fas fa-heart';
		$favDiv.appendChild($fav);

		// 所持数入力欄
		const $stockInput = document.createElement('input');
		$stockInput.type = 'number';
		$stockInput.min = 0;
		$stockInput.max = 99;
		$stockInput.className = 'form-control form-control-sm stock_td_stock align-self-center';
		$stockInput.value = stock ? stock.num : 0;

		$shipDiv.appendChild($album);
		$shipDiv.appendChild($iconDiv);
		$shipDiv.appendChild($favDiv);
		$shipDiv.appendChild($stockInput);

		fragment.appendChild($shipDiv);
	}

	target.innerHTML = '';
	target.appendChild(fragment);

	$('#ship_stock_type_select').change();
}

/**
 * 所持機体テーブル読み込み
 */
function setPlaneStockTable() {
	const target = document.getElementById('plane_stock_tbody');
	const fragment = document.createDocumentFragment();
	const imgWidth = 24;
	const imgHeight = 24;
	const planes = PLANE_DATA.filter(v => v.id > 0);
	const planeStock = loadPlaneStock();

	const max_i = planes.length;
	for (let i = 0; i < max_i; i++) {
		const plane = planes[i];
		const stock = planeStock.find(v => v.id === plane.id);

		// ラップ
		const $planeDiv = document.createElement('div');
		$planeDiv.className = `stock_tr general_tr py-1 d-flex type_` + Math.abs(plane.type);
		$planeDiv.dataset.planeid = plane.id;

		// アイコン用ラッパー
		const $iconDiv = document.createElement('div');
		$iconDiv.className = 'stock_td_type align-self-center';

		// アイコン
		const cvs = document.createElement('canvas');
		const ctx = cvs.getContext('2d');
		cvs.width = imgWidth;
		cvs.height = imgHeight;
		ctx.drawImage(IMAGES['type' + plane.type], 0, 0, imgWidth, imgHeight);

		// 機体名
		const $name = document.createElement('div');
		$name.className = 'stock_td_name font_size_14 text-left align-self-center';
		$name.textContent = plane.name;

		// お気に入り
		const $favDiv = document.createElement('div');
		$favDiv.className = `stock_td_fav font_size_18 align-self-center ${setting.favoritePlane.includes(plane.id) ? 'stock_fav' : 'stock_unfav'}`;
		const $fav = document.createElement('i');
		$fav.className = 'fas fa-heart';
		$favDiv.appendChild($fav);

		// 個数
		const $stock = document.createElement('div');
		$stock.className = 'stock_td_stock align-self-center px-2';
		$stock.textContent = stock ? getArraySum(stock.num) : 0;

		$iconDiv.appendChild(cvs);
		$planeDiv.appendChild($iconDiv);
		$planeDiv.appendChild($name);
		$planeDiv.appendChild($favDiv);
		$planeDiv.appendChild($stock);

		fragment.appendChild($planeDiv);
	}

	target.innerHTML = '';
	target.appendChild(fragment);

	$('#stock_type_select').change();
}

/**
 * 艦娘一覧テーブル初期化
 */
function initializeShipTable() {
	const $modal = $('#modal_ship_select').find('.modal-dialog');
	const tbody = document.getElementById('ship_tbody');
	const fragment = document.createDocumentFragment();
	const imgWidth = 120;
	const imgHeight = 30;
	const displayMode = $modal.find('.toggle_display_type.selected').data('mode');

	for (const ship of SHIP_DATA) {
		// ラッパー
		const $shipDiv = document.createElement('div');
		$shipDiv.className = 'ship_tr general_tr d-flex ' + (displayMode === "multi" ? 'tr_multi' : 'py-1');
		$shipDiv.dataset.shipid = ship.id;
		$shipDiv.id = 'ship_tr_' + ship.id;

		// アイコンラッパー
		const $iconDiv = document.createElement('div');
		$iconDiv.className = 'ml-1 align-self-center pt-1';
		// アイコン
		const img = document.createElement('img');
		img.width = imgWidth;
		img.height = imgHeight;
		img.src = `../img/ship/${ship.id}.png`;
		$iconDiv.appendChild(img);

		// ID 名称 ラッパー
		const $infoDiv = document.createElement('div');
		$infoDiv.className = 'ml-1 align-self-center';
		// ID
		const $idDiv = document.createElement('div');
		$idDiv.className = 'text-primary font_size_11';
		$idDiv.textContent = 'ID : ' + (ship.id > 1000 ? ship.orig + 'b' : ship.id);
		// 名称
		const $nameDiv = document.createElement('div');
		$nameDiv.className = 'd-flex';
		$nameDiv.textContent = ship.name;

		// 残り個数
		const $stockDiv = document.createElement('div');
		$stockDiv.className = 'ml-1 ship_td_stock align-self-center d-none';
		$stockDiv.textContent = '';
		$nameDiv.appendChild($stockDiv);

		$infoDiv.appendChild($idDiv);
		$infoDiv.appendChild($nameDiv);
		$shipDiv.appendChild($iconDiv);
		$shipDiv.appendChild($infoDiv);

		// スロットたち
		for (let index = 0; index < 5; index++) {
			const $slotDiv = document.createElement('div');
			$slotDiv.className = 'ship_td_slot font_size_12 align-self-center ' + (index === 0 ? 'ml-auto' : '');
			$slotDiv.textContent = (index < ship.slot.length ? ship.slot[index] : '');

			$shipDiv.appendChild($slotDiv);
		}

		fragment.appendChild($shipDiv);
	}

	tbody.innerHTML = '';
	tbody.appendChild(fragment);
}

/**
 * 引数で渡された艦種の艦娘を展開
 * @param {number} type
 */
function createShipTable(type) {
	const modal = document.getElementById('modal_ship_select').getElementsByClassName('modal-dialog')[0];
	const tbody = document.getElementById('ship_tbody');
	const displayMode = modal.querySelector('.toggle_display_type.selected').dataset.mode;
	const visibleFinal = document.getElementById('display_final')['checked'];
	const searchWord = document.getElementById('ship_word').value.trim();
	const isFrequent = document.getElementById('frequent_ship')['checked'];
	const dispInStock = document.getElementById('disp_in_stock_ship')['checked'];
	const dispEquipped = document.getElementById('disp_equipped_ship')['checked'];
	const favOnly = document.getElementById('fav_only_ship')['checked'];
	const shipStock = loadShipStock();

	if (!tbody.childElementCount) initializeShipTable();
	setting.visibleFinal = visibleFinal;
	setting.orderByFrequency = isFrequent;
	setting.inStockOnlyShip = dispInStock;
	setting.visibleEquippedShip = dispEquipped;
	setting.favoriteOnlyShip = favOnly;
	saveSetting();

	if (dispInStock) $('#disp_equipped_ship').closest('div').removeClass('d-none');
	else $('#disp_equipped_ship').closest('div').addClass('d-none');

	// 表示順の変更
	const list = tbody.getElementsByClassName('ship_tr');
	const valueList = Array.prototype.slice.call(list).map(v => {
		const ship = SHIP_DATA.find(s => s.id === castInt(v.dataset.shipid));
		return { mst: ship, dom: v };
	});
	tbody.innerHTML = '';
	// 通常ソート
	valueList.sort((a, b) => {
		if (a.mst.sort1 !== b.mst.sort1) return a.mst.sort1 - b.mst.sort1;
		else return a.mst.sort2 - b.mst.sort2;
	});
	// よく使う順ソート
	if (isFrequent && setting.selectedHistory[1]) {
		const lst = setting.selectedHistory[1];
		valueList.sort((a, b) => lst.filter(v => v === b.mst.id).length - lst.filter(v => v === a.mst.id).length);
	}

	// 反映
	let prevType = -1;
	for (const e of valueList) {
		if (type === 0 && prevType !== e.mst.type && e.mst.valid > 0) {
			const fragment = document.createDocumentFragment();
			const $typeDiv = document.createElement('div');
			$typeDiv.className = 'type_divider mt-3 type_line';
			const $type = document.createElement('div');
			$type.className = 'font_size_12 font_color_half align-self-center';
			$type.textContent = SHIP_TYPE.find(v => v.id === e.mst.type).name;
			const $typeLine = document.createElement('div');
			$typeLine.className = 'flex-grow-1 border-bottom align-self-center mx-2';
			$typeDiv.appendChild($type);
			$typeDiv.appendChild($typeLine);
			fragment.appendChild($typeDiv);
			tbody.appendChild(fragment);
			prevType = e.mst.type;
		}
		tbody.appendChild(e.dom);
	}

	if (displayMode === "multi") {
		modal.classList.add('modal-xl');
		tbody.classList.add('multi_mode');
		const a = modal.getElementsByClassName('scroll_thead')[0];
		a.classList.add('d-none');
		a.classList.remove('d-flex');
	}
	else {
		modal.classList.remove('modal-xl');
		tbody.classList.remove('multi_mode');
		const a = modal.getElementsByClassName('scroll_thead')[0];
		a.classList.add('d-flex');
		a.classList.remove('d-none');
	}
	for (const ship of SHIP_DATA) {
		const tr = document.getElementById('ship_tr_' + ship.id);
		const td_stock = tr.getElementsByClassName('ship_td_stock')[0];

		td_stock.classList.add('d-none');

		if (displayMode === "multi") tr.classList.add('tr_multi');
		else tr.classList.remove('tr_multi');
		// 検索条件
		if ((type !== 0 && type !== ship.type) || (visibleFinal && !ship.final) || (searchWord && !ship.name.includes(searchWord))) {
			tr.classList.add('d-none');
			tr.classList.remove('d-flex');
		}
		else if (favOnly && !setting.favoriteShip.includes(ship.id)) {
			// お気に入りにないものは非表示
			tr.classList.add('d-none');
			tr.classList.remove('d-flex');
		}
		else if (type === 0 && ship.valid !== 1) {
			// 全体表示では水上偵察機のみの艦娘は非表示
			tr.classList.add('d-none');
			tr.classList.remove('d-flex');
		}
		// 使用済みチェック
		else if (dispInStock && shipStock) {
			// 所持数
			const stock = shipStock.find(v => v.id === ship.id);
			// 編成数
			const usedNum = usedShip.filter(v => v === ship.id).length;
			// 初期所持数
			const stockNumber = stock ? stock.num : 0;
			// 残り利用可能数
			const enabledCount = (stockNumber - usedNum) > 0 ? stockNumber - usedNum : 0;

			// 未所持 または 全て配備済みかつ配備済みは非表示 の場合表示しない
			if (stockNumber <= 0 || (!dispEquipped && !enabledCount)) {
				tr.classList.add('d-none');
				tr.classList.remove('d-flex');
			}
			else {
				// 利用可能数
				td_stock.textContent = `×${enabledCount}`;

				// 0を切っていれば選択不可
				if (dispEquipped && !enabledCount) {
					tr.classList.remove('general_tr');
					tr.classList.add('ship_tr_disabled');
				}
				else {
					tr.classList.add('general_tr');
					tr.classList.remove('ship_tr_disabled');
				}

				td_stock.classList.remove('d-none');
				tr.classList.add('d-flex');
				tr.classList.remove('d-none');
			}
		}
		else {
			tr.classList.add('d-flex', 'general_tr');
			tr.classList.remove('d-none', 'ship_tr_disabled');
		}
	}

	// 搭載数の表示
	if (displayMode === "multi") {
		for (const e of tbody.getElementsByClassName('ship_td_slot')) {
			e.classList.add('d-none');
		}
	}
	else {
		for (const e of tbody.getElementsByClassName('ship_td_slot')) {
			e.classList.remove('d-none');
		}
	}
}

/**
 * 敵艦入力欄を生成(可視化)
 * @param {number} count (可視化)する個数
 */
function createEnemyInput(count) {
	battleCount = count;
	$('.battle_content').each((i, e) => {
		if (i < battleCount) $(e).removeClass('d-none');
		else $(e).addClass('d-none');
	});
	$('#battle_count').val(count);

	// 基地派遣セレクト調整
	$('#land_base_target_buttons').find('.btn-group').each((i, e) => {
		$(e).find('.btn').each((ii, el) => {
			if (ii < battleCount) $(el).removeClass('disabled btn-outline-secondary').addClass('btn-outline-info');
			else $(el).addClass('disabled btn-outline-secondary').removeClass('btn-outline-info');
		});
	});

	// 結果表示タブ調整
	$('#display_battle_tab').find('.nav-link').each((i, e) => {
		$(e).removeClass('active');
		if (i < battleCount) $(e).parent().removeClass('d-none');
		else $(e).parent().addClass('d-none');
	});
	$('#display_battle_tab').find('[data-disp="' + battleCount + '"]').addClass('active');
	displayBattle = battleCount;
}

/**
 * 敵一覧テーブル生成
 */
function initializeEnemyTable() {
	const fragment = document.createDocumentFragment();
	const imgWidth = 128;
	const imgHeight = 32;
	let dispData = [];
	let prevType = 0;

	for (const typeObject of ENEMY_TYPE) {
		// 姫級以外取得
		if (typeObject.id === 1) continue;
		const tmp = ENEMY_DATA.filter(x => x.type[0] === typeObject.id);
		dispData = dispData.concat(tmp.sort((a, b) => a.orig > b.orig ? 1 : a.orig < b.orig ? -1 : a.id - b.id));
	}
	// 姫系取得、IDソートして結合
	const princesses = ENEMY_DATA.filter(x => x.type[0] === 1);
	dispData = dispData.concat(princesses.sort((a, b) => a.id > b.id ? 1 : -1));

	for (const data of dispData) {
		const enemy = new Enemy(data.id)
		// ラッパー
		const $enemyDiv = document.createElement('div');
		$enemyDiv.className = 'enemy enemy_tr general_tr d-flex';
		$enemyDiv.dataset.enemyid = enemy.id;
		$enemyDiv.id = 'enemy_tr_' + enemy.id;

		// アイコンラッパー
		const $iconDiv = document.createElement('div');
		$iconDiv.className = 'ml-1 align-self-center';
		// アイコン
		const img = document.createElement('img');
		img.width = imgWidth;
		img.height = imgHeight;
		img.src = `../img/enemy/${enemy.id}.png`;
		$iconDiv.appendChild(img);

		// ID 名称 ラッパー
		const $infoDiv = document.createElement('div');
		$infoDiv.className = 'ml-1 align-self-center';
		// ID
		const $idDiv = document.createElement('div');
		$idDiv.className = 'text-primary font_size_11';
		$idDiv.textContent = 'ID : ' + (enemy.id + 1500);
		// 名称
		const $nameDiv = document.createElement('div');
		$nameDiv.className = 'font_size_12';
		$nameDiv.innerHTML = drawEnemyGradeColor(enemy.name);

		$infoDiv.appendChild($idDiv);
		$infoDiv.appendChild($nameDiv);

		// 複数表示時のカテゴリ分け罫線
		if (prevType !== enemy.type[0] && enemy.id !== -1) {
			const $typeDiv = document.createElement('div');
			$typeDiv.className = 'w-100 d-flex mt-3 divide_line';

			const $type = document.createElement('div');
			$type.className = 'font_size_12 font_color_half align-self-center';
			$type.textContent = ENEMY_TYPE.find(v => v.id === enemy.type[0]).name;

			const $typeLine = document.createElement('div');
			$typeLine.className = 'flex-grow-1 border-bottom align-self-center mx-2';

			$typeDiv.appendChild($type);
			$typeDiv.appendChild($typeLine);

			fragment.appendChild($typeDiv);

			prevType = enemy.type[0];
		}

		$enemyDiv.appendChild($iconDiv);
		$enemyDiv.appendChild($infoDiv);

		// 制空値
		const $apDiv = document.createElement('div');
		$apDiv.className = 'ml-auto align-self-center enemy_td_ap';
		$apDiv.textContent = enemy.landBaseAirPower > enemy.airPower ? `${enemy.airPower} (${enemy.landBaseAirPower})` : enemy.airPower;

		$enemyDiv.appendChild($apDiv);

		fragment.appendChild($enemyDiv);
	}
	document.getElementById('enemy_tbody').appendChild(fragment);
}

/**
 * 敵一覧テーブルを描画
 * @param {Array.<number>} type カテゴリで絞る場合のカテゴリ配列 type[0] === 0 は全て選択時
 */
function createEnemyTable(type) {
	const modal = document.getElementById('modal_enemy_select').getElementsByClassName('modal-dialog')[0];
	const tbody = document.getElementById('enemy_tbody');
	const displayMode = modal.querySelector('.toggle_display_type.selected').dataset.mode;
	const searchWord = $('#enemy_word').val().trim();

	if (!tbody.childElementCount) initializeEnemyTable();

	if (displayMode === "multi") {
		modal.classList.add('modal-xl');
		tbody.classList.add('d-flex', 'flex-wrap');
		const a = modal.getElementsByClassName('scroll_thead')[0];
		a.classList.add('d-none');
		a.classList.remove('d-flex');
	}
	else {
		modal.classList.remove('modal-xl');
		tbody.classList.remove('d-flex', 'flex-wrap');
		const a = modal.getElementsByClassName('scroll_thead')[0];
		a.classList.add('d-flex');
		a.classList.remove('d-none');
	}

	for (const enemy of ENEMY_DATA) {
		const tr = document.getElementById('enemy_tr_' + enemy.id);
		if (displayMode === "multi") tr.classList.add('enemy_tr_multi');
		else tr.classList.remove('enemy_tr_multi');

		// 艦種で絞る
		if ((type[0] !== 0 && !isContain(type, enemy.type)) || (searchWord && !enemy.name.includes(searchWord))) {
			tr.classList.add('d-none');
			tr.classList.remove('d-flex');
		}
		else {
			tr.classList.add('d-flex');
			tr.classList.remove('d-none');
		}
	}

	// 複数表示時カテゴリ分け表示
	if (displayMode === "multi") {
		if (type[0] === 0) {
			for (const e of tbody.getElementsByClassName('divide_line')) {
				e.classList.add('d-flex');
				e.classList.remove('d-none');
			}
		}
		else {
			for (const e of tbody.getElementsByClassName('divide_line')) {
				e.classList.remove('d-flex');
				e.classList.add('d-none');
			}
		}
		for (const e of tbody.getElementsByClassName('enemy_td_ap')) {
			e.classList.add('d-none');
		}
	}
	else {
		// 制空値表示
		for (const e of tbody.getElementsByClassName('divide_line')) {
			e.classList.add('d-none');
			e.classList.remove('d-flex');
		}
		for (const e of tbody.getElementsByClassName('enemy_td_ap')) {
			e.classList.remove('d-none');
		}
	}

	// 艦隊選択モーダル内のボタン非活性
	$('#modal_enemy_select').find('.btn_remove').prop('disabled', true);
}

/**
 * 機体プリセットを生成、展開
 */
function loadPlanePreset() {
	const $modal = $('#modal_plane_preset');
	// storage 読み込み
	planePreset = loadLocalStorage('planePreset');

	// storage に存在しなかった場合初期プリセットを展開
	if (!planePreset) {
		planePreset = DEFAULT_PLANE_PRESET.concat();
	}

	const parentId = castInt($('#modal_plane_preset').data('parentid'));
	let presetText = '';
	const len = planePreset.length;
	for (let index = 0; index < len; index++) {
		const preset = planePreset[index];
		let infoText = `
			<div class="preset_td preset_td_info text-danger cur_help ml-auto" data-toggle="tooltip" data-boundary="window"
				title="全ての装備が展開できません。">
				<i class="fas fa-exclamation-triangle"></i>
			</div>
		`;
		let i = 0;
		for (const plane of preset.planes) {
			if (checkInvalidPlane(parentId, PLANE_DATA.find(v => v.id === plane.id))) {
				infoText = `
				<div class="preset_td preset_td_info text-warning cur_help ml-auto" data-toggle="tooltip" data-boundary="window"
					title="展開できない装備が含まれています。">
					<i class="fas fa-exclamation-triangle"></i>
				</div>
			`;
				i++;
			}
			if (i === preset.planes.length) infoText = '';
		}

		presetText += `
			<div class="preset_tr general_tr d-flex px-1 py-1_5 my-1 w-100 cur_pointer" data-presetid="${preset.id}">
				<div class="preset_td text-primary">${index + 1}.</div>
				<div class="preset_td ml-2">${preset.name}</div>
					${infoText}
			</div>
		`;
	}

	// アラート非表示
	$modal.find('.alert').addClass('d-none');
	$modal.find('.preset_tr').removeClass('preset_selected');
	$modal.find('.preset_tbody').html(presetText);
	$modal.find('.preset_name')
		.val('左のプリセット一覧をクリック')
		.prop('disabled', true);
	$modal.find('.is-invalid').removeClass('is-invalid');
	$modal.find('.is-valid').removeClass('is-valid');
	$modal.find('.preset_preview_tbody').html('');
	$modal.find('.btn:not(.btn_cancel)').prop('disabled', true);
	$('.preset_td_info').tooltip();
}

/**
 * 機体プリセット詳細欄に引数のプリセットデータを展開
 * 第一引数にデータがなかった場合は新規作成として DOM 構築を行う
 * @param {Object} preset { id:x, name:'', planes:[] }構造のオブジェクト
 */
function drawPlanePresetPreview(preset) {
	let text = '';
	// 表示用の機体のデータ
	let planes = [];
	const $modal = $('#modal_plane_preset');
	const parentId = castInt($('#modal_plane_preset').data('parentid'));

	// アラート非表示
	$modal.find('.alert').addClass('d-none');

	// 保存編成が見つかってる場合
	if (preset) {
		$modal.find('.preset_name').val(preset.name);
		for (const plane of preset.planes) {

			const raw = PLANE_DATA.find(v => v.id === plane.id)
			const presetPlane = {
				id: plane.id,
				type: raw.type,
				name: raw.name,
				remodel: plane.remodel
			};
			planes.push(presetPlane);
		}
	}
	else {
		// プリセットが見つからなかったので新規登録画面呼び出し
		$modal.find('.preset_name').val('');

		$target.find('.' + ($target.attr('class').includes('lb_tab') ? 'lb_plane' : 'ship_plane')).each((i, e) => {
			if ($(e).hasClass('d-none')) return;
			const plane = PLANE_DATA.find(v => v.id === castInt($(e)[0].dataset.planeid));
			if (plane) {
				const presetPlane = {
					id: plane.id,
					type: plane.type,
					name: plane.name,
					remodel: castInt($(e).find('.remodel_value').text())
				};
				planes.push(presetPlane);
			}
		});

		if (planes.length === 0) $modal.find('.alert').removeClass('d-none');
	}

	const warningIcon = `
		<div class="preset_preview_td_info ml-2 text-warning cur_help" data-toggle="tooltip" title="展開先に不適合な装備です">
			<i class="fas fa-exclamation-triangle"></i>
		</div>
	`;
	for (const plane of planes) {
		const needWarning = !checkInvalidPlane(parentId, plane);
		text += `
		<div class="preset_preview_tr d-flex justify-content-start border-bottom" data-planeid="`+ plane.id + `" data-remodel="` + plane.remodel + `">
			<div class="preset_preview_td_type"><img class="img-size-25" src="../img/type/type`+ plane.type + `.png"></div>
			<div class="preset_preview_td_name ml-1 py-2">`+ plane.name + `</div>
			<div class="preset_preview_td_remodel">`+ (plane.remodel ? '★' + plane.remodel : '') + `</div>
			` + (needWarning ? warningIcon : '') + `
		</div>
		`;
	}
	$modal.find('.btn_expand_preset').prop('disabled', !preset);
	$modal.find('.btn_delete_preset').prop('disabled', !preset);
	$modal.find('.btn_commit_preset').prop('disabled', true);
	$modal.find('.preset_name').prop('disabled', planes.length === 0);
	$modal.find('.is-invalid').removeClass('is-invalid');
	$modal.find('.is-valid').removeClass('is-valid');
	$modal.find('.preset_preview_tbody').html(text);
	$modal.find('.preset_preview_td_info').tooltip();
}

/**
 * 機体プリセット更新
 */
function updatePlanePreset() {
	const presetId = castInt($('.preset_selected').data('presetid'));
	const planes = [];
	$('.preset_preview_tr').each((i, e) => {

		planes.push({ id: castInt($(e)[0].dataset.planeid), remodel: castInt($(e)[0].dataset.remodel) });
	});

	let max_id = 0;
	for (const preset of planePreset) if (max_id < preset.id) max_id = preset.id;
	const newPreset = {
		id: (presetId === -1 ? max_id + 1 : presetId),
		name: $('#modal_plane_preset').find('.preset_name').val().replace(/^\s+|\s+$/g, ''),
		planes: planes
	};

	planePreset = planePreset.filter(v => v.id !== presetId);
	planePreset.push(newPreset);
	planePreset.sort((a, b) => a.id - b.id);
	// ローカルストレージ保存
	saveLocalStorage('planePreset', planePreset);
}

/**
 * 機体プリセット削除
 */
function deletePlanePreset() {
	const presetId = castInt($('.preset_selected').data('presetid'));
	planePreset = planePreset.filter(v => v.id !== presetId);
	planePreset.sort((a, b) => a.id - b.id);
	// ローカルストレージ保存
	saveLocalStorage('planePreset', planePreset);
}

/**
 * map_dataからマップ情報を読み込む
 */
function loadMapData() {
	fetch("../js/map_data.json", { method: "GET", })
		.then(res => {
			if (res.ok) {
				res.json().then(v => {
					ENEMY_PATTERN = v['ENEMY_PATTERN'];
					// マップ関連のセレクト更新
					createMapSelect();
					createNodeSelect();
				});
			}
			else inform_danger(res.statusText);
		}).catch(error => {
			sendErrorLog(error);
		});
}

/**
 * 海域情報の動的取得(初回限定)
 */
function modal_enemy_pattern_Shown() {
	if ($('#map_select').html()) return;

	// 初回海域データの動的取得
	$('#map_select').html('<option value="1">海域データ読込中</option>');
	loadMapData();
}

/**
 * 海域選択欄生成
 */
function createMapSelect() {
	let text = '';
	for (const w of WORLD_DATA) {
		const world = w.world;
		const maps = MAP_DATA.filter(m => Math.floor(m.area / 10) === world);
		text += `<optgroup label="${w.name}">`;
		for (const m of maps) {
			const map = m.area % 10;
			text += `<option value="${m.area}">${world > 20 ? 'E' : world}-${map} : ${m.name}</option>`;
		}
	}

	$('#map_select').html(text);
	$('#select_preset_category').html(text);
}

/**
 * マス情報を生成
 */
function createNodeSelect() {
	const area = castInt($('#map_select').val());
	let lv = 0;
	if (area < 200) {
		$('#select_difficulty_div').addClass('d-none');
	}
	else {
		$('#select_difficulty_div').removeClass('d-none');
		lv = castInt($('#select_difficulty').val());
	}

	// マップ設定
	$('#map_img').attr('src', '../img/map/' + area + '.png');

	let patterns = ENEMY_PATTERN.filter(v => v.a === area && v.l === lv);
	// 重複は切る
	patterns = patterns.filter((x, i, self) => self.findIndex(v => v.n === x.n) === i);

	// 空襲はてっぺん
	patterns.sort((a, b) => {
		if (a.n == '空襲' && b.n == '空襲') return 0;
		else if (a.n == '空襲') return -1;
		else if (b.n == '空襲') return 1;
		else return 0;
	});
	const len = patterns.length;
	let text = '';
	let text2 = '';
	for (let index = 0; index < len; index++) {
		const nodeName = patterns[index].n;
		const coords = patterns[index].c;
		text += `
		<div class="d-flex node_tr general_tr justify-content-center py-1 w-100 cur_pointer" data-node="${nodeName}">
			<div class="align-self-center">${nodeName}</div>
		</div>
	`;

		// クリック座標設定
		if (coords !== '') {
			text2 += `<area class="node" title="${nodeName}" coords="${coords}" shape="rect">`;
		}
	}

	$('#node_tbody').html(text);
	$('#clickable_nodes').html(text2);
	$('#enemy_pattern_tbody').html('');
	$('#enemy_pattern_select').html('<li class="nav-item"><a class="nav-link ' + (mainColor === "#000000" ? '' : 'nav-link-dark') + ' active" data-toggle="tab" href="#">編成1</a></li>');
	$('#enemy_pattern_air_power').text('0');
	$('#enemy_display_mode_parent').addClass('d-none').removeClass('d-flex');
	$('#btn_expand_enemies').prop('disabled', true);
	$('#btn_continue_expand').prop('disabled', true);
}

/**
 * 選択されている海域情報から敵艦隊を表示する
 * @param {number} patternNo パターン番号 未指定時は0
 */
function createEnemyPattern(patternNo = 0) {
	const area = castInt($('#map_select').val());
	const node = $('.node_selected').data('node');
	let lv = 0;
	if (area < 100) $('#select_difficulty_div').addClass('d-none');
	else {
		$('#select_difficulty_div').removeClass('d-none');
		lv = castInt($('#select_difficulty').val());
	}

	// 敵艦隊一覧生成
	let text = '';
	let sumAp = 0;
	let sumFleetAntiAir = 0;
	const patterns = ENEMY_PATTERN.filter(v => v.a === area && v.n === node && v.l === lv);
	const pattern = patterns[patternNo];
	const enemies = pattern.e;
	const enemiesLength = enemies.length;
	for (let index = 0; index < enemiesLength; index++) {
		const enemy = ENEMY_DATA.find(v => v.id === enemies[index]);
		const enemyObj = new Enemy(enemy.id);
		sumAp += enemyObj.airPower;
		sumFleetAntiAir += enemyObj.antiAirBonus;
		text += `
		<div class="enemy_pattern_tr mx-1 d-flex border-bottom" data-enemyid="${enemy.id}">
			<div class="enemy_pattern_tr_image mr-1">
				<img src="../img/enemy/${enemy.id}.png" class="enemy_img">
			</div>
			<div class="enemy_pattern_tr_text">
				<div class="font_size_11 text-primary">ID: ${enemy.id + 1500}</div>
				<div>${drawEnemyGradeColor(enemy.name)}</div>
			</div>
		</div>
		`;
	}

	// 陣形補正
	const formation = FORMATION.find(v => v.id === pattern.f);
	// 艦隊防空値 [陣形補正 * 各艦の艦隊対空ボーナス値の合計] * 2
	const fleetAntiAir = Math.floor(formation.correction * sumFleetAntiAir) * 2;

	$('#enemy_pattern_anti_air').text(fleetAntiAir);
	$('#enemy_pattern_formation').text(formation.name);


	// 編成パターンタブ生成
	if (patternNo === 0) {
		let tabText = '';
		for (let i = 0; i < patterns.length; i++) {
			tabText += `
			<li class="nav-item font_size_12">
				<a class="nav-link ${mainColor === "#000000" ? '' : 'nav-link-dark'} ${i === 0 ? 'active' : ''}" data-toggle="tab" data-disp="${i}" href="#">
					${(patterns[i].d ? patterns[i].d : '編成' + (i + 1))}
				</a>
			</li>
			`;
		}
		$('#enemy_pattern_select').html(tabText);
	}

	const borders = getAirStatusBorder(sumAp);
	$('#enemy_pattern_tbody').html(text);
	$('#enemy_pattern_air_power').text(sumAp);
	$('#enemy_pattern_status0').text(borders[0]);
	$('#enemy_pattern_status1').text(borders[1]);
	$('#enemy_pattern_status2').text(borders[2]);
	$('#enemy_pattern_status3').text(borders[3]);
	$('#btn_expand_enemies').prop('disabled', false);
	$('#btn_continue_expand').prop('disabled', false);


	// 表示形式切り替えの有効無効と表示形式
	if (enemiesLength > 6) {
		$('#enemy_display_mode_parent').removeClass('d-none').addClass('d-flex');
		if (setting.enemyDisplayImage) {
			$('#enemy_pattern_tbody').find('.enemy_pattern_tr_text').addClass('d-none');
		}
		else {
			$('#enemy_pattern_tbody').find('.enemy_pattern_tr_image').addClass('d-none');
		}
	}
	else {
		$('#enemy_display_mode_parent').addClass('d-none').removeClass('d-flex');
	}
}

/**
 * 敵艦隊を展開する
 */
function expandEnemy() {
	const area = castInt($('#map_select').val());
	const node = $('.node_selected').data('node');
	const patternNo = castInt($('#enemy_pattern_select').find('.nav-link.active').data('disp'));
	let lv = 0;
	if (area >= 200) {
		lv = castInt($('#select_difficulty').val());
	}

	const pattern = ENEMY_PATTERN.filter(v => v.a === area && v.n === node && v.l === lv)[patternNo];

	// 展開対象が空襲なら防空モードに乗っ取り
	if (!isDefMode && node === '空襲') {
		toggleDefenseMode(true);
		// みんな防空に
		$('.ohuda_select').each((i, e) => { $(e).val(0); });
		$target = $('#air_raid_enemies');
	}
	else if (isDefMode && node !== '空襲') {
		toggleDefenseMode(false);
		// みんな出撃に
		$('.ohuda_select').each((i, e) => { if (castInt($(e).val()) === 0) $(e).val(-1); });
		$target = $('.battle_content:first');
	}

	// 戦闘マス情報
	const cellType = isDefMode && pattern.t !== 5 ? 3 : pattern.t;
	$target.find('.cell_type').val(cellType);
	cell_type_Changed($target.find('.cell_type'), false);
	// 陣形
	$target.find('.formation').val(pattern.f);

	// 敵展開
	$target.find('.enemy_content').each((i, e) => {
		if (i < pattern.e.length) setEnemyDiv($(e), pattern.e[i]);
		else clearEnemyDiv($(e));
	});
	// 半径
	$target.find('.enemy_range').text(pattern.r);

	// 進行航路情報を付与
	$target[0].dataset.celldata = area + "_" + pattern.n + (pattern.d ? '(' + pattern.d + ')' : '');
}

/**
 * プリセ保存画面展開時
 */
function modal_main_preset_Shown() {
	if ($('#select_preset_category').html()) return;

	// 初回海域データの動的取得
	$('#select_preset_category').html('<option value="1">海域データ読込中</option>');
	loadMapData();
}

/**
 * 編成プリセット 新規登録 / 更新処理
 */
function updateMainPreset(isUploadOnly = false) {
	// 保存する編成の内容データ
	const presetBody = encodePreset();
	// 今現在のタブ情報
	const activePreset = getActivePreset();
	// 何らかの原因でidがない場合
	if (!activePreset.id) {
		activePreset.id = getUniqueId();
	}
	// 何らかの原因でhistoryがない場合
	if (!activePreset.history.histories.length) {
		activePreset.history.histories[0] = presetBody;
	}
	// 名前の更新
	activePreset.name = document.getElementById('input_preset_name').value.trim();
	// プリセット生成
	const preset = [
		activePreset.id,
		activePreset.name,
		presetBody,
		document.getElementById('preset_remarks').value.trim(),
		formatDate(new Date(), 'yyyy/MM/dd HH:mm:ss')
	];

	if ($('#allow_upload_preset').prop('checked')) {
		// 編成のアップロード
		uploadMainPreset(preset);
	}

	// アップロードのみモードならここで終了
	if (isUploadOnly) {
		$('#modal_main_preset').modal('hide');
		return;
	}

	// プリセット一覧への登録作業
	let isUpdate = false;
	// 別名保存モードかどうか
	if ($('#modal_main_preset').find('.btn_commit_preset').hasClass('rename')) {
		// 更新になってしまわぬよう新しいidを付与 -> 上書きにならず追加になる
		const newId = getUniqueId();
		preset[0] = newId;

		// ここでidも変更して、下のupdateActivePreset処理で新タブが生成されるように
		activePreset.id = newId;
	}

	let presets = loadLocalStorage('presets');
	if (!presets) presets = [];

	for (let i = 0; i < presets.length; i++) {
		if (presets[i][0] === preset[0]) {
			// 同idを持つプリセットがあれば上書き
			presets[i] = preset;
			isUpdate = true;
			break;
		}
	}

	// 更新がなかったら新規登録
	if (!isUpdate) {
		presets.push(preset);
		inform_success(`プリセット「${preset[1]}」の新規登録が完了しました。`);
	}
	else {
		inform_success(`プリセット「${preset[1]}」の編成データの更新が完了しました。`);
	}

	// 保存編成情報更新
	saveLocalStorage('presets', presets);
	// タブ情報の更新
	updateActivePreset(activePreset);
	// タブ再構築
	setTab();

	$('#modal_main_preset').modal('hide');
}

/**
 * 編成のアップロード
 * @param {*} preset アップロード対象の編成
 */
function uploadMainPreset(preset) {

	const area = castInt($('#select_preset_category').val());
	const user = $('#upload_user').val().trim();

	setting.uploadUserName = user;
	saveSetting();

	const newPreset = {
		id: preset[0],
		name: preset[1],
		data: preset[2],
		memo: preset[3],
		createdAt: firebase.firestore.FieldValue.serverTimestamp(),
		map: area,
		level: area > 400 ? castInt($('#select_preset_level').val()) : 0,
		user: user
	};

	if (!fb) initializeFB();
	if (fb) {
		fb.runTransaction(function (tran) {
			const ref = fb.collection('presets');
			const d = ref.doc();
			return tran.get(d).then(async () => {
				await tran.set(d, newPreset);
				return newPreset;
			})
		}).then(function (res) {
			inform_success(`プリセット「${preset[1]}」の編成データのアップロードが完了しました。`);
		}).catch(function (err) {
			console.error(err);
			inform_danger('エラーが発生しました。');
		});
	}
	else inform_danger('謎の理由により、アップロードに失敗しました。');
}


/**
 * 指定したidのプリセットデータを展開する
 * @param {Object} preset 展開対象プリセット(デコード済)
 * @param {boolean} isResetLandBase データ未指定の際、基地航空隊をリセットする
 * @param {boolean} isResetFriendFleet データ未指定の際、艦隊をリセットする
 * @param {boolean} isResetEnemyFleet データ未指定の際、敵艦隊をリセットする
 */
function expandMainPreset(preset, isResetLandBase = true, isResetFriendFleet = true, isResetEnemyFleet = true) {
	if (!preset) return;
	try {
		// 基地航空隊展開
		const landBase = preset[0];
		$('.lb_plane').each((i, e) => {
			if (!landBase || landBase.length === 0) return;
			const raw = landBase[0].find(v => v[4] === i);
			if (raw && raw.length !== 0) {
				const plane = { id: raw[0], prof: raw[1], remodel: raw[2], slot: raw[3] };
				setLBPlaneDiv($(e), plane);
			}
			else if (isResetLandBase) setLBPlaneDiv($(e));
		});
		$('.ohuda_select').each((i, e) => {
			// disabled 解除
			$(e).find('option').prop('disabled', false);
			// 取得した札値
			if (landBase && landBase.length >= 2) {
				const huda = castInt(landBase[1][i], -1);
				$(e).val(huda === 1 ? 2 : huda);
			}
			else $(e).val(-1);
		});

		// 基地タゲ
		if (landBase && landBase.length >= 3) {
			for (let lbNo = 0; lbNo <= 2; lbNo++) {
				document.getElementById(`lb${lbNo + 1}_target_1`).value = landBase[2][lbNo * 2];
				document.getElementById(`lb${lbNo + 1}_target_2`).value = landBase[2][lbNo * 2 + 1];
			}
		}
		// 防空計算モード？
		if (preset.length >= 5) {
			toggleDefenseMode(preset[4]);
		}
		else {
			toggleDefenseMode(false);
		}

		if (isResetFriendFleet) {
			// 艦娘クリア
			clearShipDivAll(6);
			let shipCountFleet1 = 0;
			let shipCountFleet2 = 0;
			// 艦娘展開
			$('.ship_tab').each((i, ship_tab) => {
				const ship = preset[1].find(v => v[2] === i);
				if (!ship) return;
				const $ship_tab = $(ship_tab);
				// 艦娘設置
				setShipDiv($ship_tab, ship[0]);

				// 機体設置
				$ship_tab.find('.ship_plane').each((j, e) => {
					const $ship_plane = $(e);
					const raw = ship[1].find(v => v[4] === j);
					if (raw && !$ship_plane.hasClass('d-none')) {
						const plane = { id: raw[0], prof: raw[1], remodel: raw[2], slot: raw[3] };
						setPlaneDiv($ship_plane, plane, true);

						// スロットロック反映
						if (raw.length >= 6 && raw[5]) plane_unlock_Clicked($ship_plane.find('.plane_unlock'));
					}
				});

				// 無効化
				if (ship.length >= 4) {
					const $ship_disabled = $ship_tab.find('.ship_disabled');
					if (ship[3]) {
						$ship_disabled.addClass('disabled');
						$ship_disabled.children().addClass('fa-eye-slash').removeClass('fa-eye no_capture');
						$ship_tab.addClass('opacity4');
					}
					else {
						$ship_disabled.removeClass('disabled');
						$ship_disabled.children().removeClass('fa-eye-slash').addClass('fa-eye no_capture');
						$ship_tab.removeClass('opacity4');
					}
				}

				// 練度
				if (ship.length >= 5) {
					if (ship[4]) {
						$ship_tab.find('.ship_level').text(ship[4]);
					}
					else {
						$ship_tab.find('.ship_level').text(99);
					}
				}

				if (i < 6) shipCountFleet1++;
				else shipCountFleet2++;
			});

			$('#friendFleet_item1').find('.display_ship_count').val(Math.max(shipCountFleet1, 1));
			display_ship_count_Changed($('#friendFleet_item1').find('.display_ship_count'), true);
			$('#friendFleet_item2').find('.display_ship_count').val(Math.max(shipCountFleet2, 1));
			display_ship_count_Changed($('#friendFleet_item2').find('.display_ship_count'), true);
		}

		// 敵艦展開
		let battle = 1;
		for (let index = 0; index < preset[2].length; index++) {
			if (battle < preset[2][index][0] + 1) battle = preset[2][index][0] + 1;
		}
		battle = Math.min(battle, 10);
		// クリア
		if (preset[2].length !== 0 || isResetEnemyFleet) {
			clearEnemyDivAll(battle);
			$('#battle_count').val(battle);
		}

		// v1.11.1 以前のプリセット(preset[5]が存在せず、preset[2]に防空の敵艦隊情報が入ってしまっている場合の対処用)
		const isOldVersion = isDefMode && preset.length < 6;

		$(isOldVersion ? '#air_raid_enemies' : '.battle_content').each((i, e) => {
			const enemyFleet = preset[2].find(v => v[0] === i);
			if (enemyFleet) {
				// セル名復帰
				if (enemyFleet.length >= 3) $(e)[0].dataset.celldata = enemyFleet[2];
				else $(e)[0].dataset.celldata = '';

				// 戦闘種別復帰
				if (enemyFleet.length >= 4) {
					const cellType = castInt(enemyFleet[3]);
					if (isOldVersion) {
						$(e).find('.cell_type').val([0, 5].includes(cellType) ? 5 : 3);
					}
					else $(e).find('.cell_type').val(cellType);
					cell_type_Changed($(e).find('.cell_type'), false);
				}
				else $(e).find('.cell_type').val(1);

				// 陣形復帰
				if (enemyFleet.length >= 5) $(e).find('.formation').val(enemyFleet[4]);
				else $(e).find('.formation').val(1);

				// 半径復帰
				if (enemyFleet.length >= 6) $(e).find('.enemy_range').text(enemyFleet[5]);
				else $(e).find('.enemy_range').text(0);

				let enemyIndex = 0;
				for (const id of enemyFleet[1]) {
					const $enemyContent = $(e).find('.enemy_content').eq(enemyIndex++);
					if (id > 0) setEnemyDiv($enemyContent, id);
					// 負値の場合は直接入力の制空値
					else if (id < 0) setEnemyDiv($enemyContent, -1, -(id));
					else clearEnemyDiv($enemyContent);
					$enemyContent.addClass('d-flex').removeClass('d-none');
				}
			}
		});

		// 防空モード用敵艦展開(いれば)
		if (preset.length >= 6) {
			const enemyFleet = preset[5];
			if (enemyFleet && enemyFleet.length === 3) {

				const $container = $('#air_raid_enemies');

				// 戦闘種別復帰
				const cellType = castInt(enemyFleet[1]);
				$container.find('.cell_type').val([0, 5].includes(cellType) ? 5 : 3);
				cell_type_Changed($container.find('.cell_type'), false);

				// 陣形復帰
				$container.find('.formation').val(enemyFleet[2]);

				let enemyIndex = 0;
				for (const id of enemyFleet[0]) {
					const $enemyContent = $container.find('.enemy_content').eq(enemyIndex++);

					if (id > 0) {
						setEnemyDiv($enemyContent, id);
					}
					// 負値の場合は直接入力の制空値
					else if (id < 0) {
						setEnemyDiv($enemyContent, -1, -(id));
					}
					else {
						clearEnemyDiv($enemyContent);
					}
					$enemyContent.addClass('d-flex').removeClass('d-none');
				}
			}
		}

		// 対空砲火情報
		if (preset.length >= 4) {
			const antiAirPreset = preset[3];
			if (antiAirPreset[0] && antiAirPreset[0].length > 0) {
				fleetStage2Table = antiAirPreset[0];
			}
			else {
				// v1.9.1以前の過去データだった場合扱わない
				fleetStage2Table = [];
			}
			document.getElementById('fleet_antiair_base').value = antiAirPreset[1];
			document.getElementById('antiair_grand')['checked'] = antiAirPreset[3];
			if (antiAirPreset[3]) document.getElementById('antiair_air_raid').parentElement.classList.remove('d-none');
			document.getElementById('antiair_air_raid')['checked'] = antiAirPreset[4];
			inputAntiAirWeights = antiAirPreset[5];
			document.getElementById('fleet_antiair_formation').value = antiAirPreset[6];
		}
		else {
			fleetStage2Table = [];
			inputAntiAirWeights = [];
		}

	} catch (error) {
		// 全てクリアしておく
		$('.ohuda_select').val(-1);
		$('.lb_plane').each((i, e) => { setLBPlaneDiv($(e)); });
		clearShipDivAll(6);
		clearEnemyDivAll(1);
		$('#battle_count').val(1);

		// エラー通知
		sendErrorLog(error);
	}
}

/**
 * 現在の入力状況からbase64エンコード済みプリセットデータを生成、返却する
 * @returns {string} エンコード済プリセットデータ
 */
function encodePreset() {
	try {
		// 現在のプリセットを取得し、オブジェクトを文字列化
		const preset = [
			createLandBasePreset(),
			createFriendFleetPreset(),
			createEnemyFleetPreset(),
			createAntiAirTablePreset(),
			isDefMode,
			createAirRaidEnemyFleetPreset()
		];
		const dataString = JSON.stringify(preset);
		const b64 = utf8_to_b64(dataString);
		const utf8 = b64_to_utf8(b64);
		// 複号までチェック
		JSON.parse(utf8);

		return b64;
	}
	catch (error) {
		// 失敗時は空のプリセットデータ
		const emp = [[], [], []];
		return utf8_to_b64(JSON.stringify(emp));
	}
}

/**
 * 基地航空隊プリセットを生成し返却
 * @returns {Array} 基地プリセット
 */
function createLandBasePreset() {
	// 基地: [0:機体群, 1:札群, 2:ターゲット戦闘番号[1-1, 1-2, 2-1, ..., 3-2]]
	const landBasePreset = [[], [], []];
	// inputItemsから生成するように変更
	const landBaseAll = inputItems.landBase;

	for (const landBase of landBaseAll.landBases) {
		// 機体群
		for (const plane of landBase.planes) {
			// [ (航空隊番号 - 1) * 4 + スロット番号 ]が、画面の見た目の位置
			const planeObj = [
				plane.id,
				plane.level,
				plane.remodel,
				plane.slot,
				(landBase.baseNo - 1) * 4 + (plane.slotNo - 1)
			];
			landBasePreset[0].push(planeObj);
		}

		// 札
		landBasePreset[1].push(landBase.mode);

		// ターゲット
		landBasePreset[2].push(landBase.target[0]);
		landBasePreset[2].push(landBase.target[1]);
	}

	return landBasePreset;
}

/**
 * 艦隊プリセットを生成し返却
 * @returns {Array} 艦隊プリセット
 */
function createFriendFleetPreset() {
	// 艦隊: [0:id, 1: plane配列, 2: 配属位置, 3:無効フラグ, 4:練度]
	// 機体: [0:id, 1:熟練, 2:改修値, 3:搭載数, 4:スロット位置, 5: スロットロック(任意、ロック済みtrue]
	const friendFleetPreset = [];
	let shipIndex = 0;
	$('.ship_tab').each((i, e) => {
		// 第2艦隊の開始を検知
		if (i === 6) shipIndex = 6;
		// 非表示なら飛ばす
		if ($(e).attr('class').includes('d-none')) return;


		// 艦隊: [0:id, 1: plane配列, 2: 配属位置, 3:無効フラグ, 4:練度]
		const ship = [
			castInt($(e)[0].dataset.shipid),
			[],
			shipIndex,
			($(e).find('.ship_disabled').hasClass('disabled') ? 1 : 0),
			castInt($(e).find('.ship_level').text())
		];
		$(e).find('.ship_plane:not(.ui-draggable-dragging)').each((j, ce) => {
			const $ce = $(ce);
			const plane = [
				castInt($ce[0].dataset.planeid),
				castInt($ce.find('.prof_select')[0].dataset.prof),
				castInt($ce.find('.remodel_value').text()),
				castInt($ce.find('.slot').text()),
				j,
				($ce.find('.plane_unlock').hasClass('d-none') ? 1 : 0)
			];
			// 装備されていない場合飛ばす
			if (plane[0] !== 0) ship[1].push(plane);
		});

		// 艦娘か機体が1件でもあれば追加
		if (ship[0] !== 0 || ship[1].length !== 0) {
			friendFleetPreset.push(ship);
			// インクリメント
			shipIndex++;
		}
	});

	return friendFleetPreset;
}

/**
 * 敵艦隊プリセットを生成し返却
 * @returns {Array} 敵艦隊プリセット
 */
function createEnemyFleetPreset() {
	const enemyFleetPreset = [];
	$('.battle_content').each((i, e) => {
		// 非表示なら飛ばす
		if ($(e).attr('class').includes('d-none')) return;
		// [0:戦闘位置, 1:enemyId配列(※ 直接入力時は負値で制空値), 2:マス名, 3:マス種別, 4:陣形, 5:半径]
		const enemyFleet = [
			i,
			[],
			$(e)[0].dataset.celldata,
			castInt($(e).find('.cell_type').val()),
			castInt($(e).find('.formation').val()),
			castInt($(e).find('.enemy_range').text())
		];
		$(e).find('.enemy_content').each((j, ce) => {
			const enemyId = castInt($(ce)[0].dataset.enemyid);
			const ap = castInt($(ce).find('.enemy_ap').text());
			if (enemyFleet[3] !== CELL_TYPE.grand && j >= 6) return;
			if (enemyId === 0) enemyFleet[1].push(0);
			else if (enemyId > 0) enemyFleet[1].push(enemyId);
			// ※直接入力なら制空値を負値にして格納
			else if (ap > 0) enemyFleet[1].push(-ap);
		});

		// 空じゃなければ追加
		if (enemyFleet[1].length !== 0) enemyFleetPreset.push(enemyFleet);
	});
	return enemyFleetPreset;
}

/**
 * 敵艦隊プリセットを生成し返却
 * @returns {Array} 敵艦隊プリセット
 */
function createAirRaidEnemyFleetPreset() {
	const $container = $('#air_raid_enemies');
	// [0:enemyId配列(※ 直接入力時は負値で制空値), 1:マス種別, 2:陣形]
	const enemyFleetPreset = [
		[],
		castInt($container.find('.cell_type').val()),
		castInt($container.find('.formation').val())
	];

	// 敵艦IDを格納していく
	$container.find('.enemy_content').each((j, ce) => {
		const enemyId = castInt($(ce)[0].dataset.enemyid);
		const ap = castInt($(ce).find('.enemy_ap').text());

		if (enemyId >= 0) {
			enemyFleetPreset[0].push(enemyId);
		}
		// ※直接入力なら制空値を負値にして格納
		else if (ap > 0) {
			enemyFleetPreset[0].push(-ap);
		}
	});

	return enemyFleetPreset;
}


/**
 * 対空砲火設定情報
 */
function createAntiAirTablePreset() {
	return [
		fleetStage2Table,
		castFloat(document.getElementById('fleet_antiair_base').value),
		0,
		document.getElementById('antiair_grand')['checked'],
		document.getElementById('antiair_air_raid')['checked'],
		inputAntiAirWeights,
		castInt(document.getElementById('fleet_antiair_formation').value)
	];
}


/**
 * 指定プリセットをデッキビルダーフォーマットに変換
 * デッキフォーマット {version: 4, f1: {s1: {id: '100', items:{i1:{id:1, rf: 4, mas:7},{i2:{id:3, rf: 0}}...,ix:{id:43}}}, s2:{}...},...}（2017/2/3更新）
 * デッキフォーマット {version: 4.2, f1: {}, s2:{}...}, a1:{mode:1, items:{i1:{id:1, rf: 4, mas:7}}}（2019/12/5更新）
 * @returns {string} デッキビルダー形式データ
 */
function convertToDeckBuilder() {
	try {
		const fleet = createFriendFleetPreset();
		const landBase = createLandBasePreset();
		const obj = {
			version: 4,
			f1: {},
			f2: {},
			a1: { mode: 0, items: {} },
			a2: { mode: 0, items: {} },
			a3: { mode: 0, items: {} }
		};

		// 基地データ
		for (const plane of landBase[0]) {
			obj["a" + (Math.floor(plane[4] / 4) + 1)].items["i" + (Math.floor(plane[4] % 4) + 1)] = { id: plane[0], rf: plane[2], mas: plane[1] };
		}
		for (let index = 0; index < landBase[1].length; index++) {
			const mode = landBase[1][index];
			obj["a" + (index + 1)].mode = mode > 0 ? 1 : mode === 0 ? 2 : 0;
		}


		// 艦隊データ
		for (let index = 0; index < fleet.length; index++) {
			const ship = fleet[index];
			const shipData = SHIP_DATA.find(v => v.id === ship[0]);
			if (!shipData) continue;

			// 装備機体群オブジェクト生成
			const planes = { i1: null, i2: null, i3: null, i4: null, i5: null };
			for (const plane of ship[1]) {
				const i = { id: plane[0], rf: plane[2], mas: plane[1] };
				planes["i" + castInt(plane[4] + 1)] = i;
			}

			const s = { id: `${shipData.api}`, lv: ship[4], luck: -1, items: planes };
			const shipIndex = ship[2];
			if (shipIndex < 6) obj.f1["s" + ((shipIndex % 6) + 1)] = s;
			else obj.f2["s" + ((shipIndex % 6) + 1)] = s;
		}

		return JSON.stringify(obj);
	} catch (error) {
		return "";
	}
}


/**
 * 指定プリセットをデッキビルダーフォーマットに変換 作戦室用
 * デッキフォーマット {version: 4, f1: {s1: {id: '100', items:{i1:{id:1, rf: 4, mas:7},{i2:{id:3, rf: 0}}...,ix:{id:43}}}, s2:{}...},...}（2017/2/3更新）
 * デッキフォーマット {version: 1, f1: {}, s2:{}...}, a1:{mode:1, items:{i1:{id:1, rf: 4, mas:7}}}（2019/12/5更新）
 * @returns {string} デッキビルダー形式データ
 */
function convertToDeckBuilder_j() {
	try {
		const fleet = createFriendFleetPreset();
		const landBase = createLandBasePreset();
		const obj = {
			version: 1,
			name: getActivePreset().name,
			hqLevel: 120,
			side: "Player",
			fleetType: $('#union_fleet').prop('checked') ? "CarrierTaskForce" : "Single",
			fleets: [
				{ ships: [] },
				{ ships: [] },
			],
			landBase: [
				{ slots: [], equipments: [null, null, null, null] },
				{ slots: [], equipments: [null, null, null, null] },
				{ slots: [], equipments: [null, null, null, null] }
			],
		};

		// 基地データ
		for (let i = 0; i < landBase[0].length; i++) {
			const plane = landBase[0][i];
			const t = obj["landBase"][Math.floor(plane[4] / 4)];
			const index = Math.floor(plane[4] % 4);
			t['slots'][index] = plane[3];
			t['equipments'][index] = {
				masterId: plane[0],
				improvement: plane[2],
				proficiency: getInnerProficiency(plane[1], PLANE_DATA.find(v => v.id === plane[0]).type)
			};
		}


		// 艦隊データ
		for (let i = 0; i < fleet.length; i++) {
			const ship = fleet[i];
			const shipData = SHIP_DATA.find(v => v.id === ship[0]);
			if (!shipData) continue;

			const shipIndex = ship[2];
			const t = obj["fleets"][shipIndex < 6 ? 0 : 1];

			// 装備機体群オブジェクト生成
			const planes = [];
			const insData = { masterId: shipData.api, level: ship[4], slots: [], equipments: planes };

			for (let j = 0; j < shipData.slot.length; j++) {
				let insSlot = shipData.slot[j];
				if (ship[1].find(v => v[4] === j)) {
					insSlot = ship[1].find(v => v[4] === j)[3];
				}
				insData.slots.push(insSlot);

				// 機体
				const plane = ship[1].find(v => v[4] === j);
				if (plane) {
					planes.push({
						masterId: plane[0],
						improvement: plane[2],
						proficiency: getInnerProficiency(plane[1], PLANE_DATA.find(v => v.id === plane[0]).type)
					});
				}
				else {
					planes.push(null);
				}
			}

			t['ships'].push(insData);
		}

		return JSON.stringify(obj);
	} catch (error) {
		return "";
	}
}

/**
 * よく使う装備リスト更新
 * @param {number} id id
 */
function updatePlaneSelectedHistory(id) {
	// 先頭に挿入
	setting.selectedHistory[0].unshift(id);
	// 100件以降はケツから削る
	setting.selectedHistory[0] = setting.selectedHistory[0].splice(0, 100);
	saveSetting();
}

/**
 * よく使う艦娘リスト更新
 * @param {number} id id
 */
function updateShipSelectedHistory(id) {
	// 先頭に挿入
	setting.selectedHistory[1].unshift(id);
	// 100件以降はケツから削る
	setting.selectedHistory[1] = setting.selectedHistory[1].splice(0, 100);
	saveSetting();
}

/**
 * 結果表示を行う
 */
function drawResult() {
	// 初期化
	$('#rate_table tbody').find('.rate_tr').addClass('d-none disabled_tr');
	$('.progress_area').addClass('d-none disabled_bar').removeClass('d-flex');
	$('.simple_lb_progress').addClass('d-none').removeClass('d-flex');
	$('#fleet_simple_bar').addClass('d-none');

	const loopCount = isDefMode ? 1 : 6;
	let airPowers = [];
	let enemyAirPowers = [];
	let rateList = [];
	if (isDefMode) {
		airPowers.push(resultData.defenseAirPower);
		enemyAirPowers.push(resultData.enemyAirPowers[6]);
		rateList.push(resultData.fleetAirStatus);
	}
	else {
		// ケツに本隊制空値をぶち込む
		airPowers = resultData.landBaseAirPowers;
		airPowers.push(resultData.fleetAirPower);
		// これはそのままでOK
		enemyAirPowers = resultData.enemyAirPowers;
		// ケツに本隊制空状態確率をぶち込む
		rateList = resultData.landBaseAirStatus;
		rateList.push(resultData.fleetAirStatus);
	}
	for (let i = 0; i <= loopCount; i++) {
		// 描画対象先の行インデックス 防空8、他は連番(0は一応ヘッダのため1から)
		const targetRowIndex = isDefMode ? 8 : i + 1;
		const $target_bar = $('#result_bar_' + targetRowIndex);
		const $target_tr = $('#rate_row_' + targetRowIndex);
		const ap = airPowers[i];
		const eap = enemyAirPowers[i];
		const rates = rateList[i];
		const border = getAirStatusBorder(eap);
		let status = isDefMode ? getAirStatusIndex(ap, eap) : rates.indexOf(getArrayMax(rates));
		let width = 0;
		let visible = false;

		// 制空状態毎に基準widthに対する比率
		if (status === 4) width = ap / border[3] * 100 * 0.1;
		else if (status === 3) width = ap / border[2] * 100 * 0.2;
		else if (status === 2) width = ap / border[1] * 100 * 0.45;
		else if (status <= 1) width = ap / border[0] * 100 * 0.9;

		// 基地(含防空) && 双方制空0の場合確保にしてバーは最大
		if (status === 5 && targetRowIndex !== 7) {
			status = 0;
			width = 100;
		}
		// 本隊の場合は撃墜テーブルに従う
		else if (status === 5) {
			const abbr = $('#shoot_down_table').find('.cond.battle' + displayBattle).text();
			const airStatus = AIR_STATUS.find(v => v.abbr === abbr);
			if (airStatus) status = airStatus.id;
			if (status === 0) width = 100;
		}

		// 結果表示バーの描画
		let prevStatus = $target_bar.data('airstatus');
		const barColor = 'bar_status' + status;
		const prevBarColor = 'bar_status' + prevStatus;
		$target_bar
			.removeClass(prevBarColor)
			.addClass(barColor)
			.css({ 'width': (width > 100 ? 100 : width) + '%', })
			.data('airstatus', status);

		// 各制空状態比率の描画
		$target_tr.find('.rate_td_ap').text(ap);

		// 敵制空値とボーダーの表示
		const $rate_td_eap = $target_tr.find('.rate_td_eap');
		$rate_td_eap.find('.avg_eap').text(eap);
		$rate_td_eap.find('.eap_border').html(`( ${border.slice(0, 4).map(v => v <= ap ? `<b>${v}</b>` : v.toString()).join(' / ')} )`);

		for (let j = 0; j < rates.length; j++) {
			$target_tr.find('.rate_td_status' + j).text('-');
			if (isDefMode) $target_tr.find('.rate_td_status' + status).text('100 %');
			else if (rates[j] > 0) {
				const rate = rates[j] * 100;
				$target_tr.find('.rate_td_status' + j).text((rate === 100 ? 100 : rate.toFixed(2)) + ' %');
				visible = true;
			}
		}

		// データなしの行はバー、比率ともに非表示
		if (visible || (isDefMode && targetRowIndex === 8)) {
			$target_tr.removeClass('d-none disabled_tr');
			$target_bar.closest('.progress_area').addClass('d-flex').removeClass('d-none disabled_bar');
		}

		const exBarColor = 'bar_ex_status' + status;
		// 基地簡易バー　防空時はでっかいやつ
		if (isDefMode) {
			const $bar = $('#simple_lb_def_bar');
			const $e = $bar.find('.result_bar');
			// 前回のステータスを取得
			prevStatus = $e.data('airstatus');
			// 前回のクラスを消して新しくクラスを設定、長さ、設定を整える
			$e.removeClass(`bar_status${prevStatus} bar_ex_status${prevStatus}`)
				.addClass(`${barColor} ${exBarColor}`)
				.css({ 'width': (width > 100 ? 100 : width) + '%', })
				.data('airstatus', status);
			// 制空状態を表記
			$bar.find('.simple_label').text(AIR_STATUS.find(v => v.id === status).abbr);
			// 表示させる
			$bar.removeClass('d-none');
		}

		// 艦隊簡易バー
		if (targetRowIndex === 7 && visible && status > -1) {
			const $fleetSimpleBar = $('#fleet_simple_bar');
			const $simpleBar = $fleetSimpleBar.find('.result_bar');
			prevStatus = $simpleBar.data('airstatus');
			$simpleBar.removeClass(`bar_status${prevStatus} bar_ex_status${prevStatus}`)
				.addClass(`${barColor} ${exBarColor}`)
				.css({ 'width': (width > 100 ? 100 : width) + '%', })
				.data('airstatus', status);
			const t = `${AIR_STATUS.find(v => v.id === status).abbr}(${Math.floor(rates[status] * 100)}%)`;
			$fleetSimpleBar.find('.simple_label').text(t);
			$fleetSimpleBar.removeClass('d-none');
		}

		if (isDefMode) break;
	}

	let sumBauxiteAvg = 0;
	let sumBauxiteMax = 0;
	let sumBauxiteMin = 0;
	const calculateCount = castInt($('#calculate_count').val());
	// 出撃後スロット平均、全滅率の表示
	for (let index = 0; index < resultData.fleetSlots.length; index++) {
		const s = resultData.fleetSlots[index];
		const deathRate = s.deathRate * 100;
		const node_tr = document.getElementsByClassName('slot' + s.slot + ' shipNo' + s.shipNo)[0];
		if (!node_tr) continue;
		const initSlot = castInt(node_tr.getElementsByClassName('battle1')[0].textContent);
		if (!initSlot) continue;

		const node_battle_end = node_tr.getElementsByClassName('battle_end')[0];
		node_battle_end.textContent = Math.round(s.avg);

		const node_battle_death = node_tr.getElementsByClassName('battle_death')[0];
		node_battle_death.textContent = (s.deathRate === 0 ? '-' : deathRate >= 10 ? deathRate.toFixed(1) + ' %' : deathRate.toFixed(2) + ' %');

		// 1戦目との差分から平均ボーキ消費量を算出
		if (initSlot > 0) {
			sumBauxiteAvg += 5 * (initSlot - s.avg);
			sumBauxiteMax += 5 * (initSlot - s.max);
			sumBauxiteMin += 5 * (initSlot - s.min);
		}
	}

	// 平均鋼材消費量(1でもあれば噴式機ありモードにする)
	if (resultData.usedSteels) {
		// 平均ボーキ & 鋼材 消費量
		const avgSteel = resultData.usedSteels / calculateCount;
		if (!$('.battle_end.fap').html()) $('.battle_end.fap').html('消費予測');
		$('.battle_end.eap').html(`
		<div><img src="../img/util/bauxite.png" class="img-size-18" alt="ボーキサイト">: ${sumBauxiteAvg.toFixed(1)}</div>
		<div><img src="../img/util/steel.png" class="img-size-18" alt="鋼材">: ${avgSteel.toFixed(1)}</div>
		`);
	}
	else {
		// 平均ボーキ消費量
		if (!$('.battle_end.fap').html()) {
			$('.battle_end.fap').html('<img src="../img/util/bauxite.png" class="img-size-18" alt="ボーキサイト">消費予測');
		}
		$('.battle_end.eap').html(`${sumBauxiteMax} ~ ${sumBauxiteMin} ( ${sumBauxiteAvg.toFixed(1)} )`);
	}

	// 敵艦搭載数推移
	for (let i = 0; i < resultData.enemySlots.length; i++) {
		const s = resultData.enemySlots[i];
		const node_tr = document.getElementsByClassName('enemy_no_' + s[0] + ' slot_' + s[1])[0];
		const avg = Math.floor(10 * (s[2] / calculateCount));
		node_tr.getElementsByClassName('td_avg_slot')[0].textContent = (avg === 0 ? '0' : avg / 10);
		node_tr.getElementsByClassName('td_max_slot')[0].textContent = s[3];
		node_tr.getElementsByClassName('td_min_slot')[0].textContent = s[4];
	}

	// 棒立ち率
	if (!isDefMode && !document.getElementById('ignore_stage2')['checked'] && fleetStage2Table.length > 0) {
		for (let i = 0; i < resultData.enemySlotAllDead.length; i++) {
			const rate = Math.floor(1000 * (resultData.enemySlotAllDead[i] / calculateCount)) / 10;
			const node_tr = document.getElementsByClassName(`enemy_no_${i} slot_0`)[0];
			node_tr.getElementsByClassName('td_all_dead')[0].textContent = rate + '%';
		}
		document.getElementById('enemy_slot_result_mode').textContent = '（航空戦 stage2 後）';
	}
	else {
		document.getElementById('enemy_slot_result_mode').textContent = '（航空戦 stage1 後）';
	}

	// 敵制空値関連
	const stage1BeforAps = resultData.enemyAirPowerResults[0];
	const stage1AfterAps = resultData.enemyAirPowerResults[1];

	if (stage1BeforAps.length) {
		const dist = getEnemyApDistribution(stage1BeforAps);
		let node = document.getElementById('enemy_ap_bf_dist_min');
		for (const value of dist) {
			node.textContent = value;
			node = node.nextElementSibling;
		}
	}
	if (stage1AfterAps.length) {
		const dist = getEnemyApDistribution(stage1AfterAps);
		let node = document.getElementById('enemy_ap_af_dist_min');
		for (const value of dist) {
			node.textContent = value;
			node = node.nextElementSibling;
		}
	}

	// 基地簡易バーの描画 オブジェクトデータから描画
	const landBaseAll = inputItems.landBase;
	for (const landBase of landBaseAll.landBases) {

		const wave1 = landBase.target[0];
		const wave2 = landBase.target[1];
		if (wave1 === -1 || wave2 === -1 || isDefMode) {
			continue;
		}

		// ターゲットのうち、先に戦闘が行われる方を描画する
		const displayWave = wave1 <= wave2 ? [wave1, wave2] : [wave2, wave1];
		const resultIndex = wave1 <= wave2 ? [0, 1] : [1, 0];

		for (let j = 0; j <= 1; j++) {
			// ゲージを算出、描画
			const asResult = landBase.results[displayWave[j]].airStatusIndex[resultIndex[j]];
			const avgFap = landBase.results[displayWave[j]].mainAirPower[resultIndex[j]] / calculateCount;
			const avgEap = landBase.results[displayWave[j]].enemyAirPower[resultIndex[j]] / calculateCount;

			// 最も多い制空状態
			let status = asResult.indexOf(getArrayMax(asResult));

			let width = 0;
			const border = getAirStatusBorder(avgEap);

			// 制空状態毎に基準widthに対する比率
			if (status === 4) width = avgFap / border[3] * 100 * 0.1;
			else if (status === 3) width = avgFap / border[2] * 100 * 0.2;
			else if (status === 2) width = avgFap / border[1] * 100 * 0.45;
			else if (status <= 1) width = avgFap / border[0] * 100 * 0.9;

			// 基地(含防空) && 双方制空0の場合確保にしてバーは最大
			if (status === 5) {
				status = 0;
				width = 100;
			}

			const barColor = 'bar_status' + status;
			const exBarColor = 'bar_ex_status' + status;
			const $simpleBarParent = $(`#simple_lb_bar_${landBase.baseNo}_${j + 1}`);
			const $simpleBar = $simpleBarParent.find('.result_bar');
			const prevStatus = $simpleBar.data('airstatus');
			$simpleBar.removeClass(`bar_status${prevStatus} bar_ex_status${prevStatus}`)
				.addClass(`${barColor} ${exBarColor}`)
				.css({ 'width': (width > 100 ? 100 : width) + '%', })
				.data('airstatus', status);

			const statusText = AIR_STATUS.find(v => v.id === status).abbr;
			const v = Math.floor((getArrayMax(asResult) / calculateCount) * 100);
			const vText = v === 100 ? '' : v >= 10 ? `<span class="opacity0">1</span>` : `<span class="opacity0">11</span>`;
			const t = `${statusText}(${v}%)${vText}`;
			$simpleBarParent.find('.simple_label').html(t);
			$simpleBarParent.removeClass('d-none');
		}
	}


	display_result_Changed();

	// 重い気がする奴解放
	resultData.enemyAirPowerResults = null;
	resultData.fleetSlots = null;
}

/**
 * 数値配列から [min 上位50 25 10 5 1 max] 配列を返却
 * @param {Array<number>} data
 */
function getEnemyApDistribution(data) {
	// 昇順ソート
	data.sort((a, b) => a - b);

	const maxCount = data.length;
	const min = data[0];
	const max = data[data.length - 1];
	let par50 = 0, par75 = 0, par90 = 0, par95 = 0, par99 = 0, sumRate = 0;

	for (let i = min; i < max; i++) {
		// この値が記録された回数をカウント
		let count = 0;
		while (data.length && data[0] === i) {
			data.shift();
			count++;
		}
		// なければ次
		if (!count) continue;
		// 全体に占める割合
		sumRate += 100 * count / maxCount;
		if (!par50 && sumRate >= 50) par50 = i;
		if (!par75 && sumRate >= 75) par75 = i;
		if (!par90 && sumRate >= 90) par90 = i;
		if (!par95 && sumRate >= 95) par95 = i;
		if (!par99 && sumRate >= 99) par99 = i;
	}
	par50 = par50 ? par50 : max;
	par75 = par75 ? par75 : max;
	par90 = par90 ? par90 : max;
	par95 = par95 ? par95 : max;
	par99 = par99 ? par99 : max;
	const array = [min, par50, par75, par90, par95, par99, max];
	return array;
}

/*==================================
		計算用処理
==================================*/
/**
 * 制空値を比較し、制空状態の index を返却
 * @param {number} x ベース制空値
 * @param {number} y 比較対象制空値
 * @returns {number} 制空状態 index (0:確保 1:優勢...)
 */
function getAirStatusIndex(x, y) {
	// 味方艦隊1000以下なら事前計算テーブルから制空状態取得
	if (x <= 1000) {
		const max = AIR_STATUS_TABLE[x].length - 1;
		if (y < max) return AIR_STATUS_TABLE[x][y];
		return 4;
	}
	else {
		const border = getAirStatusBorder(y);
		const len = border.length;
		for (let i = 0; i < len; i++) if (x >= border[i]) return x !== 0 ? i : 4;
	}
}

/**
 * 引数の制空値から、必要な制空状態のボーダーを返却
 * @param {number} enemyAp 基準制空値
 * @returns {Array.<number>} 制空状態ボーダーのリスト [確保ボーダー, 優勢ボーダー, ...]
 */
function getAirStatusBorder(enemyAp) {
	if (enemyAp === 0) return [0, 0, 0, 0, 0];
	return [
		enemyAp * 3,
		Math.ceil(enemyAp * 1.5),
		Math.floor(enemyAp / 1.5) + 1,
		Math.floor(enemyAp / 3) + 1,
		0
	];
}

/**
 * 計算
 */
function calculate() {
	try {
		// 計算前初期化
		calculateInit();

		// 各状態確率計算
		rateCalculate();

		// 結果表示
		drawResult();
	} catch (error) {
		// ログ送信
		sendErrorLog(error);
	}
}

/**
 * エラーログ送信
 * @param {Object} error エラーオブジェクト
 */
function sendErrorLog(error) {
	errorInfo = {
		name: error.name,
		message: error.message,
		stack: error.stack,
		data: encodePreset(),
		createdAt: firebase.firestore.FieldValue.serverTimestamp(),
		remarks: "",
		version: "1.11.3"
	};

	console.log(error);

	const $modal = $('#modal_confirm');
	$modal.find('.modal-body').html(`
		<div>
			<div class="h5">計算処理中にエラーが発生しました。</div>
			<div class="mt-3">
				<div class="pl-3">
					ブラウザのキャッシュの問題で、正しく計算が処理できなかった可能性があります。
				</div>
				<div class="pl-3">
					このまま本画面にてブラウザのスーパーリロードをお試しください。
				</div>
				<div class="pl-2 mt-4">■ スーパーリロードを行ったが改善しない場合</div>
				<div class="pl-3 mt-1">
					大変申し訳ありません。お手数ですが、直前にどのような基地や艦娘の装備などの操作をしようとしたかを<a href="https://odaibako.net/u/noro_006" target="_blank" id="send_error">こちら</a>までご報告ください。
				</div>
				<div class="pl-3 mt-1">
					報告を頂き次第、可能な限り早期の調査、修正を行います。ご不便をおかけして申し訳ありません。
				</div>
			</div>
		</div>
	`);

	confirmType = "Error";
	$modal.modal('show');
}

/**
 * ログを送信
 */
function sendError() {
	if (!fb) initializeFB();
	if (fb) {
		fb.runTransaction(function (tran) {
			const ref = fb.collection('errors');
			const d = ref.doc();
			return tran.get(d).then(async () => {
				await tran.set(d, errorInfo);
			})
		}).then(function (res) {
		}).catch(function (err) {
		});
	}
}

/**
 * 計算前初期化 anti-JQuery
 */
function calculateInit() {
	// hide
	document.getElementById('draggable_plane_box').classList.add('d-none');

	// テーブルいったん全てリセット
	document.getElementById('ship_info_table').getElementsByTagName('tbody')[0].innerHTML = "";
	document.getElementById('shoot_down_table').getElementsByTagName('tbody')[0].innerHTML = "";
	document.getElementById('enemy_shoot_down_table').getElementsByTagName('tbody')[0].innerHTML = "";
	document.getElementById('input_summary').value = '';
	if (document.getElementsByClassName('info_defApEx')[0]) {
		document.getElementsByClassName('info_defApEx')[0].textContent = '';
	}

	for (const node of document.getElementById('shoot_down_table').getElementsByTagName('tfoot')[0].getElementsByClassName('td_battle')) {
		node.innerHTML = "";
	}
	for (const d of document.getElementById('shoot_down_table').getElementsByTagName('td')) {
		d.classList.remove('airStatus0', 'airStatus1', 'airStatus2', 'airStatus3', 'airStatus4');
	}

	// 防空時
	if (isDefMode) {
		// 艦娘 & 一般敵情報非表示
		document.getElementById('ship_info').classList.add('d-none');
		document.getElementById('shoot_down_table_content').classList.add('d-none');
		document.getElementById('friendFleet').classList.add('d-none');
		document.getElementById('normal_enemies').classList.add('d-none');
		document.getElementById('display_battle_tab').classList.add('d-none');
		// 基地空襲敵欄表示
		document.getElementById('air_raid_enemies').classList.remove('d-none');

		// 戦闘回数固定
		const node = document.getElementById('battle_count_content');
		node.classList.add('d-none');
		node.classList.remove('d-flex');
	}
	else {
		// 艦娘情報表示
		document.getElementById('ship_info').classList.remove('d-none');
		document.getElementById('shoot_down_table_content').classList.remove('d-none');
		document.getElementById('friendFleet').classList.remove('d-none');
		document.getElementById('normal_enemies').classList.remove('d-none');
		document.getElementById('display_battle_tab').classList.remove('d-none');
		// 基地空襲敵欄非表示
		document.getElementById('air_raid_enemies').classList.add('d-none');

		const node = document.getElementById('battle_count_content');
		node.classList.add('d-flex');
		node.classList.remove('d-none');
	}

	// 機体使用数テーブル初期化
	usedPlane = [];
	// 配備済み艦娘テーブル初期化
	usedShip = [];

	// 入力データの取得 / 反映
	UpdateInputData();

	// ログなど
	const currentData = encodePreset();

	// 現在アクティブなタブの履歴にどうのこうの
	const activePreset = getActivePreset();
	const history = activePreset.history;
	const histories = history.histories;

	const enabled = activePreset.id !== '';

	// 現在値と違う履歴データかチェック
	if (enabled && activePreset.id && histories[history.index] !== currentData) {
		// 現在のundo index 位置より若い履歴を削除
		if (history.index !== 0) {
			histories.splice(0, history.index);
		}
		// 0番目に挿入
		histories.unshift(currentData);

		// 20件制限
		history.histories = histories.splice(0, 20);
		history.index = 0;

		// タブを編集済みに書き換え
		const $tab = $('#fleet_tab_container .active:not(.unsaved)');
		$tab.find('.fleet_tab_icon').html('&#8727;');
		$tab.addClass('unsaved');

		updateActivePreset(activePreset);
	}

	if (enabled && history.index < history.histories.length - 1) {
		document.getElementById('btn_undo').classList.remove('disabled');
	}
	else {
		document.getElementById('btn_undo').classList.add('disabled');
	}
	if (enabled && history.index > 0) {
		document.getElementById('btn_redo').classList.remove('disabled');
	}
	else {
		document.getElementById('btn_redo').classList.add('disabled');
	}

	// 空スロット表示可否
	if (setting.emptySlotInvisible !== document.getElementById('empty_slot_invisible').checked) {
		setting.emptySlotInvisible = document.getElementById('empty_slot_invisible').checked;
		saveSetting();
	}

	// 計算結果データ初期化
	resultData = {
		enemyAirPowers: [],
		enemyAirPowerResults: [],
		enemySlots: [],
		enemySlotAllDead: [],
		landBaseAirPowers: [],
		landBaseAirStatus: [],
		fleetAirPower: 0,
		fleetAirStatus: [],
		fleetSlots: [],
		defenseAirPower: 0,
		usedSteels: 0
	};

	// 事前計算テーブルチェック
	setPreCalculateTable();
}

/**
 * 計算用入力データクラス初期化
 */
function UpdateInputData() {
	// 初期化
	inputItems = new InputData();
	// 基地情報更新
	inputItems.landBase = createLandBaseInstance();
	// 艦隊情報更新
	inputItems.fleet = createFleetInstance();
	// 敵艦情報更新
	inputItems.battleInfo = updateEnemyFleetInfo();
}

/**
 * 基地航空隊入力情報更新
 * 値の表示と制空値、半径計算も行う
 * @param {boolean} updateDisplay 画面表示物の更新を行う場合 true デフォルト true
 * @returns {LandBaseAll} 生成された基地クラス
 */
function createLandBaseInstance(updateDisplay = true) {
	const tmpLbPlanes = [];
	let ng_range_text = '';
	let summary_text = '';
	// 各航空隊の最上位スロット群
	const topPlanes = [];

	const landBaseAll = new LandBaseAll();

	const nodes_lb_tab = document.getElementsByClassName('lb_tab');
	for (let index = 0; index < nodes_lb_tab.length; index++) {
		const node_lb_tab = nodes_lb_tab[index];
		const lbNo = index + 1;
		tmpLbPlanes.length = 0;
		const landBase = new LandBase(lbNo, -1);
		summary_text = `第${lbNo}基地航空隊：`;

		// 基地航空隊 各種制空値表示
		const node_lb_planes = node_lb_tab.getElementsByClassName('lb_plane');
		for (let i = 0; i < node_lb_planes.length; i++) {
			const node_lb_plane = node_lb_planes[i];
			const slotNo = i + 1;
			if (i >= 4) break;

			const id = castInt(node_lb_plane.dataset.planeid);
			const remodel = castInt(node_lb_plane.getElementsByClassName('remodel_value')[0].textContent);
			const level = castInt(node_lb_plane.getElementsByClassName('prof_select')[0].dataset.prof);
			// スロット数取得(入力値 不正な可能性あり)
			const node_slot = node_lb_plane.getElementsByClassName('slot')[0];
			const plane = new LandBasePlane(id, castInt(node_slot.textContent), remodel, level);
			// スロット審査されてるのでそれを再設定
			node_slot.textContent = plane.slot;

			plane.slotNo = slotNo;

			if (plane.id > 0) {
				// 機体を追加
				landBase.planes.push(plane);

				// 噴式あれば
				if (!landBase.hasJet && plane.type === 9) {
					landBase.hasJet = true;
				}
			}

			// 以下表示系、未処理でいいなら次のレコードへ
			if (!updateDisplay) continue;

			// 機体使用数テーブル更新
			let usedData = usedPlane.find(v => v.id === plane.id);
			if (usedData) usedData.num[plane.remodel]++;
			else {
				usedData = { id: plane.id, num: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
				usedData.num[plane.remodel]++;
				usedPlane.push(usedData);
			}

			// 個別表示
			const node = document.getElementsByClassName(`lb_info_lb_${lbNo} slot${slotNo}`)[0];
			let node_td = node.getElementsByClassName('info_plane')[0];
			// 装備名
			const planeName = plane.name + (plane.remodel !== 0 ? `★${plane.remodel}` : '');
			node_td.className = 'info_plane ' + getPlaneCss(plane.type).replace('css', 'shoot_table');
			node_td.innerHTML = (planeName ? planeName + ' ' + getProfString(plane.level) : '-');
			// 搭載数
			node.getElementsByClassName('info_slot')[0].textContent = planeName ? plane.slot.toString() : '';
			// 制空値
			node.getElementsByClassName('info_ap')[0].textContent = planeName ? plane.airPower.toString() : '';

			summary_text += ' ' + (plane.name ? `${plane.name} ${getProfString(plane.level)}` : '未装備') + ',';
		}
		summary_text = summary_text.slice(0, -1) + '\n';

		// 機体がない場合は、待機に強制的に変更
		if (landBase.planes.findIndex(v => v.id > 0) === -1) {
			landBase.mode = -1;
			node_lb_tab.getElementsByClassName('ohuda_select')[0].value = -1;
		}

		// 出撃札状況の取得
		landBase.mode = castInt(node_lb_tab.getElementsByClassName('ohuda_select')[0].value);

		// 派遣先の取得 出撃札の時だけ
		if (landBase.mode === 2) {

			// タゲの値自体は、hidden値から取得　モーダル展開時にボタンは光らせる
			const target1 = castInt(document.getElementById(`lb${lbNo}_target_1`).value);
			const target2 = castInt(document.getElementById(`lb${lbNo}_target_2`).value);
			const lastBattle = battleCount - 1;

			// 1派目
			if (target1 <= lastBattle) {
				landBase.target[0] = target1 >= 0 ? target1 : lastBattle;
			}
			else {
				// 最終戦闘をオーバーしてたら最終戦闘に合わせる
				landBase.target[0] = lastBattle;
			}

			// 2派目
			if (target2 <= lastBattle) {
				landBase.target[1] = target2 >= 0 ? target2 : lastBattle;
			}
			else {
				// 最終戦闘をオーバーしてたら最終戦闘に合わせる
				landBase.target[1] = lastBattle;
			}

			// 最上位スロットを追加　あれば。
			if (landBase.planes.length > 0) {
				topPlanes.push(landBase.planes[0]);
			}
		}

		// 制空値を更新
		if (landBase.mode === 0) {
			landBase.updateDefenseAirPower();
		}
		else {
			landBase.updateAirPower();
			landBase.fullAirPower = landBase.airPower;
		}

		// 生成した航空隊データを格納
		landBaseAll.landBases.push(landBase);

		// 以下表示系、未処理でいいなら次のレコードへ
		if (!updateDisplay) continue;

		// 計算モードと、お札のモードが一致していない場合は薄くする
		if ((isDefMode && landBase.mode !== 0) || (!isDefMode && landBase.mode !== 2)) {
			node_lb_tab.classList.add('opacity6');
		}
		else {
			node_lb_tab.classList.remove('opacity6');
		}

		// 出撃、配備コスト
		const node_resource = node_lb_tab.getElementsByClassName('resource')[0];
		const node_bauxite = node_resource.getElementsByClassName('bauxite')[0];
		const node_fuel = node_resource.getElementsByClassName('fuel')[0];
		const node_ammo = node_resource.getElementsByClassName('ammo')[0];
		drawChangeValue(node_fuel, castInt(node_fuel.textContent), landBase.getSumFuel(), true);
		drawChangeValue(node_ammo, castInt(node_ammo.textContent), landBase.getSumAmmo(), true);
		drawChangeValue(node_bauxite, castInt(node_bauxite.textContent), landBase.getSumBauxite(), true);

		// 鋼材
		const node_steel = node_resource.getElementsByClassName('steel')[0];
		const sumSteel = landBase.getSumSteel();
		if (sumSteel) {
			drawChangeValue(node_steel, castInt(node_steel.textContent), sumSteel, true);
			node_steel.classList.remove('d-none');
			node_steel.previousElementSibling.classList.remove('d-none');
		}
		else {
			node_steel.classList.add('d-none');
			node_steel.previousElementSibling.classList.add('d-none');
		}

		// 総制空値 それぞれの基地のモード毎によって。
		const sumAirPower = landBase.mode === 0 ? landBase.defenseAirPower : landBase.airPower;

		const node_trs = document.getElementsByClassName('lb_info_lb_' + lbNo);
		let node_target_td = node_trs[0].getElementsByClassName('info_sumAp')[0];
		drawChangeValue(node_target_td, castInt(node_target_td.textContent), sumAirPower);
		let node_span = node_lb_tab.getElementsByClassName('ap')[0];
		drawChangeValue(node_span, castInt(node_span.textContent), sumAirPower);

		// 制空値内訳表示
		const apList = landBase.mode === 0 ? landBase.planes.map(v => v.defenseAirPower) : landBase.planes.map(v => v.airPower);

		if (landBase.reconCorr > 1.0) {
			node_lb_tab.getElementsByClassName('ap_detail')[0].textContent = `( ${apList.join(' / ')} ) × ${landBase.reconCorr}`;
		}
		else {
			node_lb_tab.getElementsByClassName('ap_detail')[0].textContent = `( ${apList.join(' / ')} )`;
		}

		// 半径
		const range = landBase.getRange();
		node_target_td = node_trs[0].getElementsByClassName('info_range')[0];
		drawChangeValue(node_target_td, castInt(node_target_td.textContent), range);
		node_span = node_lb_tab.getElementsByClassName('range')[0];
		drawChangeValue(node_span, castInt(node_span.textContent), range);

		// 半径が足りていないなら文言追加
		if (landBase.mode > 0) {
			const node = document.getElementById('battle_container').getElementsByClassName('enemy_range');
			if (node.length >= landBase.target[0] && castInt(node[landBase.target[0]].textContent) > range) {
				ng_range_text += (ng_range_text.length ? ',' : '') + (index + 1);
			}
			else if (node.length >= landBase.target[1] && castInt(node[landBase.target[1]].textContent) > range) {
				ng_range_text += (ng_range_text.length ? ',' : '') + (index + 1);
			}
		}

		for (const node_tr of node_trs) {
			// 待機 or モードにそぐわない札は非表示
			if ((isDefMode && landBase.mode === 0) || (!isDefMode && landBase.mode === 2)) {
				node_tr.classList.remove('d-none');
			}
			else node_tr.classList.add('d-none');
		}

		// 待機 or 機体なしの場合飛ばす
		if ((isDefMode && landBase.mode === 0) || (!isDefMode && landBase.mode === 2) && landBase.planes.length) {
			document.getElementById('input_summary').value += summary_text.trim() + '\n';
		}
	}

	// 以下表示系、未処理でいいなら終了
	if (!updateDisplay) {
		return landBaseAll;
	}

	// 全部待機かどうか
	let visiblePlaneCount = 0;
	const node_tr = document.getElementById('lb_info_table').getElementsByTagName('tbody')[0].getElementsByClassName('lb_info_tr');
	for (const node of node_tr) if (!node.classList.contains('d-none')) visiblePlaneCount++;
	document.getElementById('lb_info').classList.remove('col-lg-8', 'col-xl-7');
	document.getElementById('lb_info').classList.add('col-lg-6');
	if (visiblePlaneCount > 0) {
		$('#lb_info_table tbody').find('.info_defAp').remove();
		for (const h of document.getElementById('lb_info_table').getElementsByTagName('tbody')[0].getElementsByClassName('info_defAp')) h.remove();
		if (isDefMode) {
			// 総制空値合計
			landBaseAll.updateDefenseAirPower();
			const sumAp = landBaseAll.defenseAirPower;
			const sumAp_ex = landBaseAll.defense2AirPower;

			// 重爆時の全体的な制空値と補正値
			document.getElementById('def_sum_ap_all').textContent = sumAp;
			document.getElementById('def_sum_ex_ap_all').textContent = sumAp_ex;
			document.getElementById('rocket_c').textContent = landBaseAll.rocketBonus;

			// 防空時は半径の後ろの最終防空時制空値を表示　半径は非表示
			document.getElementById('lb_info').classList.add('col-lg-8', 'col-xl-7');
			document.getElementById('lb_info').classList.remove('col-lg-6');
			const node_table = document.getElementById('lb_info_table');
			for (const node of node_table.getElementsByClassName('info_range')) node.classList.add('d-none');
			for (const node of node_table.getElementsByClassName('info_defAp')) node.classList.remove('d-none');

			for (const node_tr of node_table.getElementsByClassName('lb_info_tr')) {
				if (!node_tr.classList.contains('d-none')) {
					let node_td = document.createElement('td');
					node_td.className = 'info_defAp';
					node_td.rowSpan = visiblePlaneCount;
					node_td.textContent = sumAp;
					node_tr.appendChild(node_td);

					node_td = document.createElement('td');
					node_td.className = 'info_defAp info_defApEx';
					node_td.rowSpan = visiblePlaneCount;
					node_td.textContent = sumAp_ex;
					node_tr.appendChild(node_td);

					break;
				}
			}
		}
		else {
			const node_table = document.getElementById('lb_info_table');
			for (const node of node_table.getElementsByClassName('info_range')) node.classList.remove('d-none');
			for (const node of node_table.getElementsByClassName('info_defAp')) node.classList.add('d-none');
		}

		// 半径足りませんよ表示
		document.getElementById('ng_range').textContent = ng_range_text;
		document.getElementById('lb_info_table').getElementsByClassName('info_warning')[0].classList.add('d-none');
		if (ng_range_text.length) {
			document.getElementById('lb_range_warning').classList.remove('d-none');
			inform_warning(`第${ng_range_text}基地航空隊の半径が不足しています。`);
		}
		else {
			document.getElementById('lb_range_warning').classList.add('d-none');
		}

		document.getElementById('input_summary').value += '\n';
	}
	else {
		document.getElementById('lb_info_table').getElementsByClassName('info_warning')[0].classList.remove('d-none');
		document.getElementById('lb_range_warning').classList.add('d-none');
	}

	// 基地入力欄の半径、触接表示有無
	for (const e of document.getElementsByClassName('battle_only')) {
		if (isDefMode) e.classList.add('d-none');
		else e.classList.remove('d-none');
	}
	// 基地入力欄の防空時ステータス表示有無
	if (isDefMode) {
		document.getElementById('defense_summary').classList.remove('d-none');
		document.getElementById('defense_summary').classList.add('d-flex');
	}
	else {
		document.getElementById('defense_summary').classList.remove('d-flex');
		document.getElementById('defense_summary').classList.add('d-none');
	}

	// 基地空襲おこした？アラート
	let needAlert = false;
	// 防空部隊がない
	if (landBaseAll.landBases.findIndex(v => v.mode === 0) === -1) {
		// 一番上の機体が18機か4機
		for (const plane of topPlanes) {
			if ((plane.isRecon && plane.slot === 4) || (!plane.isRecon && plane.slot === 18)) {
				needAlert = true;
				break;
			}
		}
	}

	if (!isDefMode && needAlert) {
		document.getElementById('air_raid_alert').classList.remove('d-none');
	}
	else {
		document.getElementById('air_raid_alert').classList.add('d-none');
	}

	return landBaseAll;
}

/**
 * 低い方の内部熟練度を返す　設定次第で最大は120になる
 * @param {number} level 熟練度レベル
 * @param {number} type 機体カテゴリ
 */
function getInnerProficiency(level, type) {
	switch (level) {
		case 7:
			return initialProf120Plane.includes(Math.abs(type)) ? 120 : 100;
		case 0:
			return 0;
		case 1:
			return 10;
		case 2:
			return 25;
		case 3:
			return 40;
		case 4:
			return 55;
		case 5:
			return 70;
		case 6:
			return 85;
		default:
			return 0;
	}
}

/**
 * 航空隊の制空補正値を返却
 * @param {*} plane
 * @param {boolean} [isDefence=false] 防空時の補正が必要な場合true
 * @returns 補正倍率
 */
function getReconnaissancesAdjust(plane, isDefence = false) {
	// 出撃時補正
	if (!isDefence && plane.type === 104) {
		// 陸上偵察機補正
		return (plane.scout === 9 ? 1.18 : plane.scout === 8 ? 1.15 : 1.00);
	}
	// 防空時補正
	else if (isDefence) {
		if (plane.type === 104) {
			// 陸上偵察機補正
			return (plane.scout === 9 ? 1.24 : 1.18);
		}
		else if (plane.type === 4) {
			// 艦上偵察機補正
			return (plane.scout > 8 ? 1.3 : 1.2);
		}
		else if ([5, 8].includes(plane.type)) {
			// 水上偵察機補正
			return (plane.scout > 8 ? 1.16 : plane.scout === 8 ? 1.13 : 1.1);
		}
	}

	return 1.0;
}

/**
 * 機体オブジェクトから触接選択率を返却 [0:確保時, 1:優勢時, 2:劣勢時]
 * @param {*} plane オブジェクト
 */
function getContactSelectRate(plane) {
	// 触接選択率　改式。実際はこっち [3, 2, 1].map(v => plane.scout / (20 - (2 * v)));
	if ([2, -2, 4, 5, 8, 104].includes(plane.type)) {
		let scout = plane.scout;
		const remodel = plane.remodel;

		switch (plane.id) {
			case 102:
				// 九八式水上偵察機(夜偵)
				scout = Math.ceil(scout + 0.1 * remodel);
				break;
			case 25:  // 零式水上偵察機
			case 163:	// Ro.43水偵
			case 304:	// S9 Osprey
			case 370:	// Swordfish Mk.II改(水偵型)
			case 239:	// 零式水上偵察機11型乙(熟練)
				scout = Math.ceil(scout + 0.14 * remodel);
				break;
			case 59:
				// 零式水上観測機
				scout = Math.ceil(scout + 0.2 * remodel);
				break;
			case 61:
				// 二式艦上偵察機
				scout = Math.ceil(scout + 0.25 * remodel);
				break;
			case 151:
				// 試製景雲(艦偵型)
				scout = Math.ceil(scout + 0.4 * remodel);
				break;
			default:
				break;
		}

		return [scout / 14, scout / 16, scout / 18];
	}
	return [];
}

/**
 * 艦娘入力情報更新
 * 値の表示と制空値計算も行う
 * @param {boolean} updateDisplay 表示物の更新を行う場合 true デフォルト true
 * @returns {Fleet} 艦隊情報クラス
 */
function createFleetInstance(updateDisplay = true) {
	let summary_text = '';
	let node_ship_tabs = null;
	const fleet = new Fleet();

	// 連合艦隊モードかどうか
	const isUnionFleet = $('#union_fleet').prop('checked');

	if (isUnionFleet) {
		// 連合艦隊モードの場合、全艦を対象とする
		node_ship_tabs = document.getElementsByClassName('ship_tab');
	}
	else {
		// 非連合艦隊モードの場合、表示されている艦隊を対象とする
		node_ship_tabs = $('.friendFleet_tab.show.active')[0].getElementsByClassName('ship_tab');
	}
	setting.isUnion = isUnionFleet;
	saveSetting();

	for (let index = 0; index < node_ship_tabs.length; index++) {
		const node_ship_tab = node_ship_tabs[index];
		const shipNo = index + 1;

		const shipId = castInt(node_ship_tab.dataset.shipid);
		if (shipId) usedShip.push(shipId);
		// 非表示 / 無効 なら飛ばす
		if (node_ship_tab.classList.contains('d-none') || node_ship_tab.getElementsByClassName('ship_disabled')[0].classList.contains('disabled')) continue;

		const shipInstance = new Ship(shipNo);
		shipInstance.id = shipId;

		// 装備射程
		let planeRange = 0;
		let slotNo = 0;
		for (const node_ship_plane of node_ship_tab.getElementsByClassName('ship_plane')) {
			// draggable部分 非表示部分は飛ばす
			if (node_ship_plane.classList.contains('ui-draggable') || node_ship_plane.classList.contains('d-none')) continue;
			// 機体オブジェクト生成
			const id = castInt(node_ship_plane.dataset.planeid);
			const remodel = castInt(node_ship_plane.getElementsByClassName('remodel_value')[0].textContent);
			const level = castInt(node_ship_plane.getElementsByClassName('prof_select')[0].dataset.prof);
			const slot_node = node_ship_plane.getElementsByClassName('slot')[0];
			const plane = new ShipPlane(id, castInt(slot_node.textContent), remodel, level);
			// スロット審査されてるので再設定
			slot_node.textContent = plane.slot;

			plane.slotNo = slotNo++;

			shipInstance.planes.push(plane);

			// 長射程機体
			if (!planeRange && LONGRANGES.includes(plane.id)) {
				planeRange = 3;
			}

			// 対地判定
			if (shipInstance.taichi && plane.type === 3 && !TAICHI.includes(plane.id)) {
				// 対地不可
				shipInstance.taichi = plane.slot === 0;
			}

			// ジェット機持ちかどうか
			if (!fleet.hasJet && plane.type === 9) {
				fleet.hasJet = true;
			}

			// 機体使用数テーブル更新
			let usedData = usedPlane.find(v => v.id === plane.id);
			if (usedData) usedData.num[plane.remodel]++;
			else {
				usedData = { id: plane.id, num: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
				usedData.num[plane.remodel]++;
				usedPlane.push(usedData);
			}
		}

		// 連合設定 かつ 6番目以降
		shipInstance.isEscort = isUnionFleet && shipNo > 6;

		// 艦載機があれば代入
		if (shipInstance.planes.findIndex(v => v.id > 0) > -1) {
			fleet.ships.push(shipInstance);
		}

		// 制空値更新
		shipInstance.updateAirPower();
		shipInstance.initFullAirPower();

		// 練度
		shipInstance.level = castInt(node_ship_tab.getElementsByClassName('ship_level')[0].textContent);

		// 以下表示系、未処理でいいなら次のレコードへ
		if (!updateDisplay) continue;

		// 撃墜テーブルに表示する数
		let planeCount = 0
		for (const plane of shipInstance.planes) {
			if (plane.id > 0 && plane.slot > 0) {
				planeCount++;
			}
		}

		// 艦娘横の制空値など反映
		const node_ap = node_ship_tab.getElementsByClassName('ap')[0];
		const prevAp = castInt(node_ap.textContent);

		drawChangeValue(node_ap, prevAp, shipInstance.airPower);

		const ship = shipId ? SHIP_DATA.find(v => v.id === shipId) : null;

		// 射程 装備射程 -> 艦娘射程の優先順
		let shipRange = planeRange === 3 ? 3 : ship ? ship.range : 0;
		const rangeText = node_ship_tab.getElementsByClassName('ship_range')[0];
		if (rangeText) {
			rangeText.textContent = RANGES.find(v => v.id === shipRange).name;
		}
		// 対地攻撃可能？
		const taichText = node_ship_tab.getElementsByClassName('can_attack_lb')[0];
		if (taichText) {
			// 空母かつ対地不可
			if (ship && [7, 11, 18].includes(ship.type) && !shipInstance.taichi) {
				taichText.classList.remove('d-none');
			}
			else {
				taichText.classList.add('d-none');
			}
		}

		if (planeCount > 0) {
			// 撃墜テーブル & 入力情報テーブル生成
			const shoot_fragment = document.createDocumentFragment();
			const info_fragment = document.createDocumentFragment();

			let isFirst = true;
			// 表示スロット設定
			const invisibleEmptySlot = document.getElementById('empty_slot_invisible').checked;
			if (ship && !invisibleEmptySlot) {
				// 空スロットも表示する場合、マスタのスロット数に変更
				planeCount = ship.slot.length;
			}

			summary_text = (ship ? ship.name : '未指定') + '：';

			let shootTemplate = document.createElement('tr');
			let infoTemplate = document.createElement('tr');

			for (let i = 0; i < shipInstance.planes.length; i++) {
				const plane = shipInstance.planes[i];
				const planeName = plane.name;

				// 艦娘未指定の場合 搭載数 0 または艦載機未装備 のスロットは表示しない
				if (!ship && (plane.id === 0 || plane.slot === 0)) continue;
				// 艦娘の場合 スロット以上は作らない
				if (ship && i === ship.slot.length) break;
				// 掲示板用
				summary_text += ' ' + (planeName ? `${planeName} ${getProfString(plane.level)}` : '未装備') + ',';
				// 艦娘でも被搭載スロットを表示しない場合は抜ける
				if (ship && invisibleEmptySlot && (plane.id === 0 || plane.slot === 0)) continue;

				const backCss = getPlaneCss(plane.type).replace('css', 'shoot_table');

				if (isFirst) {
					// 撃墜テーブル構築
					const node_battle_tr = document.createElement('tr');
					node_battle_tr.className = `slot${i} shipNo${shipNo}`;
					node_battle_tr.dataset.shipid = !ship ? 0 : ship.id;
					node_battle_tr.dataset.shipindex = fleet.ships.length - 1;
					node_battle_tr.dataset.slotindex = i;
					node_battle_tr.dataset.css = backCss + '_hover';

					const node_ship_name_td = document.createElement('td');
					node_ship_name_td.rowSpan = planeCount;
					node_ship_name_td.className = 'td_name align-middle';
					node_ship_name_td.textContent = ship ? ship.name : '未指定';
					node_battle_tr.appendChild(node_ship_name_td);

					const node_plane_name_td = document.createElement('td');
					node_plane_name_td.className = 'pl-1 td_plane_name align-middle ' + backCss;
					node_plane_name_td.textContent = planeName;
					node_battle_tr.appendChild(node_plane_name_td);
					shootTemplate.appendChild(node_plane_name_td.cloneNode(false));

					// 撃墜テーブル 10戦闘分
					for (let j = 1; j <= 10; j++) {
						const node_battle_td = document.createElement('td');
						node_battle_td.className = `td_battle battle${j} align-middle`;
						node_battle_tr.appendChild(node_battle_td);
						shootTemplate.appendChild(node_battle_td.cloneNode(false));
					}

					const node_battle_end_td = document.createElement('td');
					node_battle_end_td.className = 'td_battle battle_end align-middle';
					node_battle_tr.appendChild(node_battle_end_td);
					shootTemplate.appendChild(node_battle_end_td.cloneNode(false));

					const node_battle_death_td = document.createElement('td');
					node_battle_death_td.className = 'td_battle battle_death align-middle';
					node_battle_tr.appendChild(node_battle_death_td);
					shootTemplate.appendChild(node_battle_death_td.cloneNode(false));

					shoot_fragment.appendChild(node_battle_tr);
				}
				else {
					// shootTemplateの書き換えだけで済ませる
					const new_tr = shootTemplate.cloneNode(true);
					new_tr.className = `slot${i} shipNo${shipNo}`;
					new_tr.dataset.shipid = !ship ? 0 : ship.id;
					new_tr.dataset.shipindex = fleet.ships.length - 1;
					new_tr.dataset.slotindex = i;
					new_tr.dataset.css = backCss + '_hover';

					const tdPlaneName = new_tr.getElementsByClassName('td_plane_name')[0];
					tdPlaneName.className = 'pl-1 td_plane_name align-middle ' + backCss;
					tdPlaneName.textContent = planeName;

					shoot_fragment.appendChild(new_tr);
				}

				const infoPlaneName = planeName + (plane.remodel !== 0 ? `★${plane.remodel}` : '');

				// 入力情報テーブル構築
				if (isFirst) {
					const node_info_tr = document.createElement('tr');
					node_info_tr.className = `ship_info_tr slot${i + 1}`;

					const node_info_name_td = document.createElement('td');
					node_info_name_td.rowSpan = planeCount;
					node_info_name_td.className = 'info_name';
					node_info_name_td.textContent = ship ? ship.name : '未指定';
					node_info_tr.appendChild(node_info_name_td);

					const node_info_plane_name_td = document.createElement('td');
					node_info_plane_name_td.className = 'info_plane ' + backCss;
					node_info_plane_name_td.innerHTML = `${infoPlaneName} ${getProfString(plane.level)}`;
					node_info_tr.appendChild(node_info_plane_name_td);
					infoTemplate.appendChild(node_info_plane_name_td.cloneNode(false));

					const node_info_info_slot_td = document.createElement('td');
					node_info_info_slot_td.className = 'info_slot';
					node_info_info_slot_td.textContent = plane.slot;
					node_info_tr.appendChild(node_info_info_slot_td);
					infoTemplate.appendChild(node_info_info_slot_td.cloneNode(false));

					const node_info_info_ap_td = document.createElement('td');
					node_info_info_ap_td.className = 'info_ap';
					node_info_info_ap_td.textContent = plane.airPower;
					node_info_tr.appendChild(node_info_info_ap_td);
					infoTemplate.appendChild(node_info_info_ap_td.cloneNode(false));

					const node_info_sumAp_td = document.createElement('td');
					node_info_sumAp_td.rowSpan = planeCount;
					node_info_sumAp_td.className = 'info_sumAp';
					node_info_sumAp_td.textContent = shipInstance.airPower;
					node_info_tr.appendChild(node_info_sumAp_td);

					info_fragment.appendChild(node_info_tr);
				}
				else {
					// infoTemplateの書き換えだけで済ませる
					const new_tr = infoTemplate.cloneNode(true);
					new_tr.className = `ship_info_tr slot${i + 1}`;

					const tdPlaneName = new_tr.getElementsByClassName('info_plane')[0];
					tdPlaneName.className = 'info_plane ' + backCss;
					tdPlaneName.innerHTML = `${infoPlaneName} ${getProfString(plane.level)}`;

					new_tr.getElementsByClassName('info_slot')[0].textContent = plane.slot;
					new_tr.getElementsByClassName('info_ap')[0].textContent = plane.airPower;

					info_fragment.appendChild(new_tr);
				}

				isFirst = false;
			}
			document.getElementById('shoot_down_table_tbody').appendChild(shoot_fragment);

			const node_info_tbody = document.getElementById('ship_info_table').getElementsByTagName('tbody')[0];
			node_info_tbody.appendChild(info_fragment);

			const node_info_trs = node_info_tbody.getElementsByTagName('tr');
			if (node_info_trs.length > 0) {
				for (const node_tr of node_info_trs[node_info_trs.length - 1].getElementsByTagName('td')) {
					// 最下部のtdに下線
					node_tr.classList.add('last_slot');
				}
			}

			document.getElementById('input_summary').value += summary_text.slice(0, -1) + '\n';
		}
		else if (document.getElementById('shoot_down_table_tbody').getElementsByTagName('tr').length === 0) {
			const node_battle_tr = document.createElement('tr');
			node_battle_tr.className = 'slot0 shipNo0';

			const node_ship_name_td = document.createElement('td');
			node_ship_name_td.className = 'td_name align-middle';
			node_ship_name_td.textContent = '未選択';
			node_battle_tr.appendChild(node_ship_name_td);

			const node_plane_name_td = document.createElement('td');
			node_plane_name_td.className = 'td_plane_name text-nowrap align-middle text-center';
			node_plane_name_td.textContent = '-';
			node_battle_tr.appendChild(node_plane_name_td);

			for (let j = 1; j <= 10; j++) {
				const node_battle_td = document.createElement('td');
				node_battle_td.className = `td_battle battle${j} align-middle`;
				node_battle_tr.appendChild(node_battle_td);
			}

			const node_battle_end_td = document.createElement('td');
			node_battle_end_td.className = 'td_battle battle_end align-middle';
			node_battle_end_td.textContent = shipInstance.airPower;
			node_battle_tr.appendChild(node_battle_end_td);

			document.getElementById('shoot_down_table_tbody').appendChild(node_battle_tr);
		}

		if (shipInstance.planes.length && shipInstance.airPower) {
			node_ship_tab.getElementsByClassName('ap_detail')[0].textContent = `( ${shipInstance.planes.map(v => v.airPower).join(' / ')} )`;
		}
		else {
			node_ship_tab.getElementsByClassName('ap_detail')[0].textContent = '';
		}
	}

	// 艦隊制空値更新
	fleet.updateAirPower();
	fleet.initFullAirPower();

	// 以下表示系、未処理でいいなら終了
	if (!updateDisplay) {
		return fleet;
	}

	let planes = [];
	for (const ship of fleet.ships) {
		planes = planes.concat(ship.planes);
	}

	// 触接テーブルより、制空権確保時の合計触接率を取得
	const contactRate = createContactTable(planes)[0][4];
	const contactRateN = Math.floor(fleet.nightContactRate(isUnionFleet) * 1000) / 10;
	if (isUnionFleet) {
		// 第1艦隊
		document.getElementsByClassName('fleet_ap')[0].textContent = fleet.airPower;
		document.getElementsByClassName('contact_start_rate')[0].textContent = `${contactRate.toFixed(1)}%`;
		document.getElementsByClassName('night_contact_rate')[0].textContent = `${contactRateN}%`;
		// 第2艦隊
		document.getElementsByClassName('fleet_ap')[1].textContent = fleet.escortAirPower;
		document.getElementsByClassName('contact_start_rate')[1].textContent = `${contactRate.toFixed(1)}%`;
		document.getElementsByClassName('night_contact_rate')[1].textContent = `${contactRateN}%`;

	}
	else {
		// 表示されている艦隊の制空値
		$('.friendFleet_tab.show.active')[0].getElementsByClassName('fleet_ap')[0].textContent = fleet.airPower;
		$('.friendFleet_tab.show.active')[0].getElementsByClassName('contact_start_rate')[0].textContent = `${contactRate.toFixed(2)}%`;

		// 夜間触接率
		$('.friendFleet_tab.show.active')[0].getElementsByClassName('night_contact_rate')[0].textContent = `${contactRateN}%`;
	}

	const ship_info_tbody = document.getElementById('ship_info_table').getElementsByTagName('tbody')[0];
	const rowsCount = ship_info_tbody.getElementsByTagName('tr').length;
	if (rowsCount) {
		// 艦娘情報テーブル　艦隊総制空値列追加
		const node_info_fleetAp = document.createElement('td');
		node_info_fleetAp.className = 'info_fleetAp';
		node_info_fleetAp.rowSpan = rowsCount;
		node_info_fleetAp.textContent = fleet.airPower;

		ship_info_tbody.getElementsByClassName('ship_info_tr')[0].appendChild(node_info_fleetAp);

		$('#ship_info_table').find('.info_warning').addClass('d-none');
		document.getElementById('ship_info_table').getElementsByClassName('info_warning')[0].classList.add('d-none');
	}
	else document.getElementById('ship_info_table').getElementsByClassName('info_warning')[0].classList.remove('d-none');

	// 掲示板用高さ調整
	const $textarea = $('#input_summary');
	const lines = ($textarea.val() + '\n').match(/\n/g).length;
	$textarea.height(castInt($textarea.css('lineHeight')) * lines + 2);
	$textarea.val($textarea.val().trim());

	return fleet;
}

/**
 * 味方艦隊から触接テーブル生成
 * @param {Array<Plane>} planes
 * @returns
 */
function createContactTable(planes) {
	let sumCotactValue = 0;
	// 補正率別　触接選択率テーブル[ 0:確保時, 1:優勢時, 2:劣勢時 ]
	const contact120 = [[], [], []];
	const contact117 = [[], [], []];
	const contact112 = [[], [], []];

	// データ読み取り
	for (const plane of planes) {
		if (plane.id === 0 || !plane.selectRate.length) continue;

		sumCotactValue += plane.contact;
		for (let i = 0; i < 3; i++) {
			if (plane.accuracy >= 3) contact120[i].push(plane.selectRate[i]);
			else if (plane.accuracy === 2) contact117[i].push(plane.selectRate[i]);
			else contact112[i].push(plane.selectRate[i]);
		}
	}
	const a = Math.floor(sumCotactValue) + 1;
	// 開始触接率ズ [ 0:確保時, 1:優勢時, 2:劣勢時 ] 改式: int(sum(索敵 * sqrt(搭載)) + 1) / (70 - 15 * c)
	const contactStartRate = [
		Math.min(a / 25, 1),
		Math.min(a / 40, 1),
		Math.min(a / 55, 1)
	];

	// 実触接率actualContactRate = [ 0:確保, 1:優勢, 2:劣勢 ] それぞれの要素内に [ 120%, 117%, 112% ]が入る
	const actualContactRate = [[], [], []];
	let sum = 1;
	for (let i = 0; i < 3; i++) {
		let tmpRate = contactStartRate[i];
		// 補正のデカいものから優先的に
		if (contact120[i].length) {
			sum = 1;
			// 全て選択されない確率の導出
			for (const rate of contact120[i]) sum *= (1 - rate);
			// 選択率
			const rate = tmpRate * (1 - sum);
			actualContactRate[i].push(rate);
			tmpRate -= rate;
		}
		else actualContactRate[i].push(0);

		if (contact117[i].length) {
			sum = 1;
			for (const rate of contact117[i]) sum *= (1 - rate);
			const rate = tmpRate * (1 - sum);
			actualContactRate[i].push(rate);
			tmpRate -= rate;
		}
		else actualContactRate[i].push(0);

		if (contact112[i].length) {
			sum = 1;
			for (const rate of contact112[i]) sum *= (1 - rate);
			const rate = tmpRate * (1 - sum);
			actualContactRate[i].push(rate);
		}
		else actualContactRate[i].push(0);
	}

	const contactTable = [[], [], []];
	for (let i = 0; i < 3; i++) {
		contactTable[i].push(100 * contactStartRate[i]);
		contactTable[i] = contactTable[i].concat(actualContactRate[i].map(v => 100 * v));
		contactTable[i].push(Math.min(100 * getArraySum(actualContactRate[i]), 100));
	}
	return contactTable;
}

/**
 * 敵艦隊入力情報読み込み、生成
 * @param {boolean} updateDisplay trueなら表示系も全て更新、書き換える　デフォルト true
 * @returns {BattleData}
 */
function updateEnemyFleetInfo(updateDisplay = true) {
	let sumAp = 0;
	let sumLBAp = 0;
	let sumAntiAirBonus = 0;
	let map = "999-1";
	let cells = "";
	let isMixed = false;
	let isAllSubmarine = true;
	let isAntiAirCutinEnabled = false;
	const battleData = new BattleData();

	for (let node_battle_content of document.getElementsByClassName('battle_content')) {
		// 防空時は専用のフォームから。
		if (isDefMode) node_battle_content = document.getElementById('air_raid_enemies');
		if (isDefMode && battleData.battles.length > 0) break;

		// 非表示なら飛ばす
		if (node_battle_content.classList.contains('d-none')) continue;

		const battle = new Battle();
		sumAp = 0;
		sumLBAp = 0;
		sumAntiAirBonus = 0;
		isAllSubmarine = true;

		// マス情報格納
		battle.cellType = castInt(node_battle_content.getElementsByClassName('cell_type')[0].value);

		// 敵情報取得
		for (const node_enemy_content of node_battle_content.getElementsByClassName('enemy_content')) {
			let enemyId = castInt(node_enemy_content.dataset.enemyid);
			let enemyIndex = castInt(node_enemy_content.getElementsByClassName('enemy_index')[0].dataset.index);
			const enemy = new Enemy(enemyId);
			// 非表示の敵は飛ばす
			if (node_enemy_content.classList.contains('d-none')) continue;

			// 連合以外で6隻埋まってたら以降は飛ばす
			if (battle.cellType !== CELL_TYPE.grand && battle.enemies.length === 6) break;

			// 潜水以外が含まれていればAll潜水フラグを落とす
			if (isAllSubmarine && !enemy.type.includes(18) && enemy.id > 0) {
				isAllSubmarine = false;
			}

			// 対空CI可能艦がいるかどうか
			if (!isAntiAirCutinEnabled && ANTIAIR_CUTIN_ENEMY.includes(enemy.id)) {
				isAntiAirCutinEnabled = true;
			}

			// 連合かつ7隻目以降
			enemy.isEscort = battle.cellType === CELL_TYPE.grand && enemyIndex > 6;

			battle.enemies.push(enemy);
			sumAp += enemy.airPower;
			sumLBAp += enemy.landBaseAirPower;

			// 艦隊防空ボーナス加算
			sumAntiAirBonus += enemy.antiAirBonus;
		}

		// 潜水マスフラグを持たせる
		if (battle.enemies.length) {
			battle.isAllSubmarine = isAllSubmarine;
		}

		// 陣形補正
		const formationId = castInt(node_battle_content.getElementsByClassName('formation')[0].value);
		const formation = FORMATION.find(v => v.id === formationId);
		const aj1 = formation ? formation.correction : 1.0;

		battle.formation = formation.id;
		battle.createStage2Table();
		battleData.battles.push(battle);

		// 以下表示系、未処理でいいなら次のレコードへ
		if (!updateDisplay) continue;

		// 制空値表示
		let node = node_battle_content.getElementsByClassName('enemy_sum_ap')[0];
		node.textContent = sumAp;
		node = node_battle_content.getElementsByClassName('enemy_sum_lbap')[0];
		node.textContent = sumLBAp;
		node = node_battle_content.getElementsByClassName('enemy_range')[0];
		if (!castInt(node.textContent)) node.parentNode.classList.add('d-none');
		else node.parentNode.classList.remove('d-none');
		node = node_battle_content.getElementsByClassName('fleet_AA')[0];
		node.textContent = Math.floor(aj1 * sumAntiAirBonus) * 2;

		// 航路情報を取得　なければ手動
		const mapInfo = !node_battle_content.dataset.celldata ? map.replace('-', '') + "_手動" : node_battle_content.dataset.celldata;
		let world = mapInfo.split('_')[0].slice(0, -1);
		world = world > 20 ? "E-" : world + "-";
		const area = world + mapInfo.split('_')[0].slice(-1);
		const cellText = mapInfo.split('_')[1];
		if (map === "999-1") map = area;
		else if (!isMixed && map !== area) isMixed = true;
		cells += (!cells ? cellText : " → " + cellText);
	}

	// 以下表示系、未処理でいいなら終了
	if (!updateDisplay) {
		return battleData;
	}

	if (!isDefMode) {
		if (map.includes('999-')) document.getElementById('route').value = "海域未指定";
		else document.getElementById('route').value = !isMixed ? map + "：" + cells : "別海域のセルが混在しています。";
	}

	if (document.getElementById('enemy_cutin_contain')) {
		if (isAntiAirCutinEnabled) {
			document.getElementById('enemy_cutin_contain').classList.remove('d-none');
		}
		else {
			document.getElementById('enemy_cutin_contain').classList.add('d-none');
		}
	}

	// 敵艦載機撃墜テーブル構築
	const enemies = battleData.battles[isDefMode ? 0 : displayBattle - 1].enemies.filter(v => v.slots.length > 0);
	let shootDownTableHTML = [];
	let enemyNo = 0;
	for (let i = 0; i < enemies.length; i++) {
		const enemy = enemies[i];
		if (enemy.onlyScout || !enemy.slots.length) continue;

		let enemy_name_td_text = '';
		let enemy_tr_text = '';
		let isFirst = true;

		let slotIndex = -1;
		for (let j = 0; j < enemy.equipments.length; j++) {
			const plane = ENEMY_PLANE_DATA.find(v => v.id === enemy.equipments[j].id);
			if (!plane || plane.type > 1000) continue;

			slotIndex++;
			const slotNum = enemy.slots[slotIndex];
			const backCss = getPlaneCss(plane.type).replace('css', 'shoot_table');
			const isLastSlot = slotIndex === enemy.slots.length - 1 ? ' last_slot' : '';
			let col_header_text = '';
			let detail_td_text = '';
			let death_td_text = '';

			// 機体画像
			enemy_name_td_text += `<img src="../img/plane/${plane.id}.png" class="img-size-36" data-planeid="${plane.id}">`;

			if (isFirst) {
				// 先頭行限定のtd
				col_header_text = `
				<td class="td_name align-middle last_slot" rowspan="${enemy.slots.length}">
					<div>${drawEnemyGradeColor(enemy.name)}</div>
					<div>xxPxx</div>
				</td>`;
				death_td_text = `<td class="td_all_dead align-middle last_slot" rowspan="${enemy.slots.length}"></td>`;
				detail_td_text = `<td class="td_detail_slot align-middle last_slot" rowspan="${enemy.slots.length}"><i class="fas fa-file-text"></i></td>`;

				isFirst = false;
			}

			enemy_tr_text += `
			<tr class="enemy_no_${enemyNo} slot_${slotIndex}" data-rowindex="${enemyNo}" data-slotindex="${slotIndex}" data-css="${backCss}_hover">
				${col_header_text}
				<td class="pl-1 td_plane_name align-middle ${backCss + isLastSlot}">${plane.name}</td>
				<td class="td_init_slot align-middle${isLastSlot}">${slotNum}</td>
				<td class="td_avg_slot align-middle${isLastSlot}">${slotNum}</td>
				<td class="td_max_slot align-middle${isLastSlot}">${slotNum}</td>
				<td class="td_min_slot align-middle${isLastSlot}">${slotNum}</td>
				${isDefMode ? '' : death_td_text}
				${isDefMode ? '' : detail_td_text}
			</tr>`;
		}

		shootDownTableHTML.push(enemy_tr_text.replace('xxPxx', enemy_name_td_text));
		enemyNo++;
	}

	if (!shootDownTableHTML.length) {
		shootDownTableHTML.push(`<tr><td colspan="8">戦闘機、攻撃機を搭載した敵艦がいない戦闘です。</td></tr>`);
	}
	document.getElementById('enemy_shoot_down_tbody').innerHTML = shootDownTableHTML.join('\r\n');

	if (!isDefMode && !document.getElementById('ignore_stage2')['checked'] && fleetStage2Table.length > 0) {
		$('.td_all_dead').removeClass('d-none');
	}
	else {
		$('.td_all_dead').addClass('d-none');
	}

	if (!isDefMode) {
		$('.td_detail_slot').removeClass('d-none');
	}
	else {
		$('.td_detail_slot').addClass('d-none');
	}

	return battleData;
}

/**
 * 敵機撃墜処理 (繰り返し用)
 * @param {number} index 制空状態
 * @param {Array<Enemy>} enemyFleet 撃墜対象の敵艦隊
 */
function shootDownEnemy(index, enemyFleet, enabledStage2 = false, stage2Tables = []) {
	const max_i = enemyFleet.length;

	// 対空CIの選択
	const pickRate = Math.random() * 100;
	const tableIndex = stage2Tables.findIndex(v => v.border > pickRate);
	const stage2 = tableIndex >= 0 ? stage2Tables[tableIndex].table : [];
	const range = stage2.length;

	for (let i = 0; i < max_i; i++) {
		const enemy = enemyFleet[i];
		const max_j = enemy.slots.length;
		enemy.airPower = 0;
		enemy.landBaseAirPower = 0;
		let sumAp = 0;
		for (let j = 0; j < max_j; j++) {
			let slot = enemy.slots[j];
			// stage1 撃墜
			enemy.slots[j] -= getShootDownSlot(index, slot);

			// stage2 撃墜 するしない 攻撃機ならする
			if (enabledStage2 && range > 0 && enemy.attackers[j]) {
				slot = enemy.slots[j];
				// 迎撃担当選出
				const table = stage2[Math.floor(Math.random() * range)];
				// 割合撃墜　50% で失敗
				if (Math.floor(Math.random() * 2)) slot -= Math.floor(table[0] * slot);
				// 固定撃墜　50% で失敗
				if (Math.floor(Math.random() * 2)) slot -= table[1];
				// 最低保証
				slot -= table[2];
				// 0未満になったら修正
				enemy.slots[j] = slot > 0 ? slot : 0;
			}
			// 新しい制空値よ
			sumAp += Math.floor(enemy.antiAirs[j] * Math.sqrt(Math.floor(enemy.slots[j])));
		}

		// 制空値の更新
		enemy.landBaseAirPower = sumAp;
		if (!enemy.onlyScout) enemy.airPower = sumAp;
	}
}

/**
 * 引数の制空状態、搭載数をもとに撃墜数を返却 撃墜数はランダム
 * @param {number} index 制空状態インデックス
 * @param {number} slot 撃墜前搭載数
 * @returns {number} 撃墜数
 */
function getShootDownSlot(index, slot) {
	// 撃墜テーブルから撃墜数を取得
	const range = SHOOT_DOWN_TABLE_ENEMY[slot][index].length;
	return SHOOT_DOWN_TABLE_ENEMY[slot][index][Math.floor(Math.random() * range)];
}

/**
 * 噴式強襲
 * @param {LandBase} landBase 基地
 * @param {Battle} battleInfo 敵艦隊
 */
function doLandBaseJetPhase(landBase, battleInfo) {
	const range = battleInfo.stage2[0][0].length;

	if (!range || landBase.mode !== 2 || !landBase.hasJet) {
		return;
	}

	for (let j = 0; j < landBase.planes.length; j++) {
		const plane = landBase.planes[j];
		if (plane.type !== 9) continue;

		// 噴式強襲st1
		// st1 0.6掛け
		plane.slot -= Math.floor(0.6 * getShootDownSlotFF(0, Math.round(plane.slot)));

		// 噴式強襲st2
		// 迎撃担当インデックス
		const index = Math.floor(Math.random() * range);
		// 割合撃墜 50% で失敗
		if (Math.floor(Math.random() * 2)) plane.slot -= Math.floor(battleInfo.stage2[plane.avoid][0][index] * plane.slot);
		// 固定撃墜 50% で失敗
		if (Math.floor(Math.random() * 2)) plane.slot -= battleInfo.stage2[plane.avoid][1][index];

		plane.updateAirPower();
	}

	// この航空隊の制空値を再計算
	landBase.updateAirPower();
}

/**
 * 噴式強襲
 * @param {Fleet} fleet 味方艦隊
 * @param {Battle} battleInfo 敵艦隊
 * @returns 使った鋼材の量
 */
function doJetPhase(fleet, battleInfo) {
	const range = battleInfo.stage2[0][0].length;
	// 戦闘マスが通常/連合戦闘マスじゃないなら強襲なし　ALL潜水も除外
	if (!fleet.hasJet || !range || battleInfo.cellType > CELL_TYPE.grand || battleInfo.isAllSubmarine) return 0;
	let steel = 0;
	for (let i = 0; i < fleet.ships.length; i++) {
		const ship = fleet.ships[i];
		for (let j = 0; j < ship.planes.length; j++) {
			const plane = ship.planes[j];
			if (plane.type !== 9) continue;
			// 鋼材のお支払い
			steel += Math.round(plane.slot * plane.cost * 0.2);

			// 噴式強襲st1
			// st1 0.6掛け
			plane.slot -= Math.floor(0.6 * getShootDownSlotFF(0, Math.round(plane.slot)));

			// 噴式強襲st2
			// 迎撃担当インデックス
			const index = Math.floor(Math.random() * range);
			// 割合撃墜 50% で失敗
			if (Math.floor(Math.random() * 2)) plane.slot -= Math.floor(battleInfo.stage2[plane.avoid][0][index] * plane.slot);
			// 固定撃墜 50% で失敗
			if (Math.floor(Math.random() * 2)) plane.slot -= battleInfo.stage2[plane.avoid][1][index];

			plane.updateAirPower();
		}
	}

	return steel;
}

/**
 * 自陣被撃墜
 * @param {number} asIndex 制空状態
 * @param {Fleet} fleet 味方艦隊
 * @param {Battle} battleInfo 戦闘情報(enemies: 敵id羅列 stage2: st2撃墜テーブル cellType: 戦闘タイプ)
 * @param {number} battle 戦闘番号
 */
function shootDownFriend(asIndex, fleet, battleInfo, battle) {
	const range = battleInfo.stage2[0][0].length;
	// 双方制空0(asIndex === 5)の場合、制空権確保となるので変更
	if (asIndex === 5) asIndex = 0;
	const sTable = SHOOT_DOWN_TABLE;
	const isNormalBattle = battleInfo.cellType === CELL_TYPE.normal || battleInfo.cellType === CELL_TYPE.airRaid;
	const needStage2 = battleInfo.cellType <= CELL_TYPE.grand;
	const len = fleet.ships.length;
	for (let i = 0; i < len; i++) {
		const ship = fleet.ships[i];

		// 通常戦闘の場合、第2艦隊スキップ
		const isSkip = isNormalBattle && ship.isEscort;

		const planeLen = ship.planes.length;
		for (let j = 0; j < planeLen; j++) {
			const plane = ship.planes[j];
			// この戦闘開始時のスロット数を記録
			plane.results[battle] += plane.slot;

			// 0機スロ 非制空争い機は搭載数を据え置いてスキップ
			if (plane.slot <= 0 || !plane.canBattle || isSkip || !range) {
				continue;
			}

			// st1撃墜 噴式の場合0.6掛け
			const table = sTable[plane.slot][asIndex];
			const downNumber = table[Math.floor(Math.random() * table.length)];
			plane.slot -= Math.floor(plane.type === 9 ? 0.6 * downNumber : downNumber);

			// st2撃墜 (攻撃機のみ)
			if (plane.isAttacker && needStage2) {
				// 迎撃担当
				const index = Math.floor(Math.random() * range);
				const stage2Table = battleInfo.stage2[plane.avoid];
				// 割合撃墜 50% で失敗
				if (Math.floor(Math.random() * 2)) plane.slot -= Math.floor(stage2Table[0][index] * plane.slot);
				// 固定撃墜 50% で失敗
				if (Math.floor(Math.random() * 2)) plane.slot -= stage2Table[1][index];
			}

			// 制空値再計算 偵察機以外
			if (plane.canBattle && plane.slot > 0) {
				// 基本制空値 + ボーナス制空値
				plane.airPower = Math.floor(plane.antiAir * Math.sqrt(plane.slot) + plane.bonusAirPower);
			}
			else if (plane.slot <= 0) {
				plane.slot = 0;
				plane.airPower = 0;
			}
			else {
				plane.airPower = 0;
			}
		}
		// 制空値更新
		ship.updateAirPower();
	}
	// 制空値更新
	fleet.updateAirPower();
}

/**
 * 自陣被撃墜
 * @param {number} asIndex 制空状態
 * @param {LandBase} landBase 味方艦隊
 * @param {Battle} battleInfo 戦闘情報
 */
function shootDownLandBase(asIndex, landBase, battleInfo) {
	const range = battleInfo.stage2[0][0].length;

	// 敵艦なしの場合スキップ
	if (!range) return;

	// 双方制空0(asIndex === 5)の場合、制空権確保となるので変更
	if (asIndex === 5) asIndex = 0;
	const sTable = SHOOT_DOWN_TABLE;
	const len = landBase.planes.length;
	for (let j = 0; j < len; j++) {
		const plane = landBase.planes[j];
		// 0機スキップ
		if (plane.slot <= 0) continue;

		// st1撃墜 噴式の場合0.6掛け
		const table = sTable[plane.slot][asIndex];
		const downNumber = table[Math.floor(Math.random() * table.length)];
		plane.slot -= Math.floor(plane.type === 9 ? 0.6 * downNumber : downNumber);

		// st2撃墜
		if (plane.isAttacker) {
			// 迎撃担当
			const index = Math.floor(Math.random() * range);
			const stage2Table = battleInfo.stage2[plane.avoid];
			// 割合撃墜 50% で失敗
			if (Math.floor(Math.random() * 2)) plane.slot -= Math.floor(stage2Table[0][index] * plane.slot);
			// 固定撃墜 50% で失敗
			if (Math.floor(Math.random() * 2)) plane.slot -= stage2Table[1][index];
		}

		// この機体の制空値を再計算
		plane.updateAirPower();
	}

	// この航空隊の制空値を再計算
	landBase.updateAirPower();
}

/**
 * 引数の制空状態、搭載数をもとに撃墜後の搭載数を返却 撃墜数はランダム
 * @param {number} index 制空状態インデックス
 * @param {number} slot 撃墜前搭載数
 * @returns {number} 撃墜後搭載数(整数)
 */
function getShootDownSlotFF(index, slot) {
	// 撃墜テーブルから撃墜数を取得
	const downTable = SHOOT_DOWN_TABLE[slot][index];
	return downTable[Math.floor(Math.random() * downTable.length)];
}

/**
 * 基地航空隊基本火力取得
 * @param {number} id 機体id
 * @param {number} slot 搭載数
 * @param {number} remodel 改修値
 */
function getLandBasePower(id, slot, remodel) {
	const plane = PLANE_DATA.find(v => v.id === id);
	if (!plane) return 0;

	const type = Math.abs(plane.type);

	// 実雷装 or 爆装 陸攻は改修係数0.7
	let fire = 0;
	// ※種別倍率：艦攻・艦爆・水爆 = 1.0、陸攻 = 0.8、噴式機 = 0.7071 (≒1.0/√2)　そのた0
	let adj = 0;
	switch (type) {
		case 2:
			fire = Plane.getBonusTorpedo(type, remodel) + plane.torpedo;
			adj = 1.0;
			break;
		case 3:
			fire = Plane.getBonusBomber(type, remodel, plane.antiAir) + plane.bomber;
			adj = 1.0;
			break;
		case 6:
			fire = Plane.getBonusBomber(type, remodel, plane.antiAir) + plane.bomber;
			adj = 1.0;
			break;
		case 9:
			fire = Plane.getBonusBomber(type, remodel, plane.antiAir) + plane.bomber;
			adj = 0.7071;
			break;
		case 101:
		case -101:
		case 105:
			fire = Plane.getBonusTorpedo(type, remodel) + plane.torpedo;
			adj = 0.8;
			break;
		default:
			break;
	}

	// 基本攻撃力 = 種別倍率 × {(雷装 or 爆装) × √(1.8 × 搭載数) + 25}
	const p = Math.floor(adj * (fire * Math.sqrt(1.8 * slot) + 25));
	// 陸攻補正
	if (type === 101 || type === 105) {
		return 1.8 * p;
	}
	else {
		return 1.0 * p;
	}
}

/**
 * 各種制空状態確率計算
 * @returns {object}
 */
function rateCalculate() {
	// 引数群
	const landBaseData = inputItems.landBase;
	const fleet = inputItems.fleet;
	const battleData = inputItems.battleInfo;
	let maxCount = castInt($('#calculate_count').val());
	maxCount = maxCount <= 0 ? 1 : maxCount;
	$('#calculate_count').val(maxCount);
	const fleetLen = fleet.ships.length;
	const battleInfo = battleData.battles;
	// 計算する戦闘
	let mainBattle = isDefMode ? 0 : (displayBattle - 1);

	// 結果格納群
	// 各制空状態の分布
	const fleetASDist = [0, 0, 0, 0, 0, 0];

	// 緒戦の最終味方制空値
	const avgMainAps = [];
	// 緒戦の最終敵制空値
	const avgEnemyAps = [];

	// 出撃終了時点の結果格納用
	const slotResults = [];

	// 敵スロット明細 (各戦闘毎に以下データ [敵スロット番号, sum, max, min])
	const enemySlotResult = [];
	const enemyAps = [[], []];
	const maxBattle = isDefMode ? 1 : battleCount;
	let sumUsedSteels = 0;

	// 味方stage2テーブルの生成有無
	const stage2Table = fleetStage2Table.concat();
	const enabledStage2 = !isDefMode && !document.getElementById('ignore_stage2')['checked'] && stage2Table.length > 0;
	// 敵の棒立ち回数記録
	const enemySlotAllDead = [];

	// 搭載数のない敵艦を全て除外(stage2テーブルは生成済み)
	for (const info of battleInfo) {
		info.enemies = info.enemies.filter(v => v.id === -1 || v.slots.length > 0);
	}

	mainBattle = mainBattle < battleData.battles.length ? mainBattle : battleData.battles.length - 1;
	for (let i = 0; i < maxBattle; i++) {
		avgMainAps.push(0);
		avgEnemyAps.push(0);
	}
	for (let i = 0; i < fleetLen; i++) {
		for (let j = 0; j < fleet.ships[i].planes.length; j++) {
			slotResults.push(new Array(maxCount));
		}
	}
	// 表示戦闘の敵スロット保持用テーブル準備
	for (let i = 0; i < battleInfo[mainBattle].enemies.length; i++) {
		const enemy = battleInfo[mainBattle].enemies[i];

		// 偵察機のみ搭載艦は飛ばす(いまは1機でも含まれてたらそうなるが...)
		if (enemy.onlyScout || enemy.id < 0) {
			continue;
		}
		// 敵インデックス
		const enemyNo = enemySlotResult.length === 0 ? 0 : enemySlotResult[enemySlotResult.length - 1][0] + 1;
		// 有効スロット数だけ作成
		for (let j = 0; j < enemy.slots.length; j++) {
			enemySlotResult.push([enemyNo, j, 0, 0, 999]);
		}
		enemySlotAllDead.push(0);
	}

	// 1戦目の戦闘形態で重爆かどうか判定 (1戦は絶対なんかデータあるのでnullがくるこたないはず)
	const defAp = battleInfo[0].cellType === CELL_TYPE.highAirRaid ? landBaseData.defense2AirPower : landBaseData.defenseAirPower;
	resultData.defenseAirPower = defAp;

	let defEnemyAp = 0;
	if (isDefMode || battleInfo[0]) {
		defEnemyAp = battleInfo[0].getAirPower();
	}

	for (let count = 0; count < maxCount; count++) {

		// 道中含めてブン回し
		for (let battle = 0; battle < maxBattle; battle++) {
			const thisBattleInfo = battleInfo[battle];
			const enemies = thisBattleInfo.enemies;

			// 基地戦闘
			calculateLandBase(landBaseData, thisBattleInfo, battle);

			// 噴式強襲フェーズ
			sumUsedSteels += doJetPhase(fleet, thisBattleInfo);

			const fap = isDefMode ? defAp : thisBattleInfo.cellType !== CELL_TYPE.grand ? fleet.airPower : fleet.unionAirPower;
			const eap = thisBattleInfo.getAirPower();
			const airIndex = getAirStatusIndex(fap, eap);

			// 表示戦闘での制空状態を記録
			if (battle === mainBattle) fleetASDist[airIndex]++;

			// この戦闘での双方の開始時制空値を記録
			avgMainAps[battle] += fap;
			avgEnemyAps[battle] += eap;

			// 味方st1 & st2
			shootDownFriend(airIndex, fleet, thisBattleInfo, battle);

			// 表示戦闘の敵搭載数記録
			if (battle === mainBattle) {
				// 敵st1 & st2
				shootDownEnemy(airIndex, enemies, enabledStage2, stage2Table);

				let index = 0;
				let index2 = 0;
				let downAp = 0;
				for (let i = 0; i < enemies.length; i++) {
					const enemy = enemies[i];
					if (enemy.onlyScout || enemy.id < 0) continue;
					const slots = enemy.slots;
					const attackers = enemy.attackers.concat();
					for (let j = 0; j < slots.length; j++) {
						const slotValue = slots[j];
						const slotResult = enemySlotResult[index++];
						// 合計値
						slotResult[2] += slotValue;
						// 最大値更新
						if (slotResult[3] < slotValue) slotResult[3] = slotValue;
						// 最小値更新
						if (slotResult[4] > slotValue) slotResult[4] = slotValue;
						// 全滅判定
						if (slotValue === 0) attackers[j] = false;
					}

					// 棒立ち判定
					if (attackers.indexOf(true) < 0) enemySlotAllDead[index2]++;
					index2++;

					downAp += enemy.airPower;
				}
				enemyAps[0].push(eap);
				enemyAps[1].push(downAp);
			}

			// 敵機補給
			for (const enemy of enemies) {
				enemy.slots = enemy.fullSlots.concat();
				enemy.airPower = enemy.fullAirPower;
				enemy.landBaseAirPower = enemy.fullLandBaseAirPower;
			}
		}

		// 基地の補給
		for (let i = 0; i < 3; i++) {
			const landBase = landBaseData.landBases[i];
			if (landBase.mode === 0) {
				continue;
			}

			for (let j = 0; j < landBase.planes.length; j++) {
				const plane = landBase.planes[j];
				plane.slot = plane.fullSlot;
				plane.airPower = plane.fullAirPower
			}
			landBase.airPower = landBase.fullAirPower;
		}

		// カーソル
		let resultIndex = 0;
		// 自艦隊各種スロット清算、補給
		for (let i = 0; i < fleetLen; i++) {
			const ship = fleet.ships[i];
			const planesLen = ship.planes.length;
			ship.airPower = 0;
			for (let j = 0; j < planesLen; j++) {
				const plane = ship.planes[j];
				slotResults[resultIndex++][count] = plane.slot;
				plane.slot = plane.fullSlot;
				plane.airPower = plane.fullAirPower;

				ship.airPower += plane.airPower;
			}
			ship.airPower = ship.fullAirPower;
		}
		fleet.airPower = fleet.fullAirPower;
		fleet.escortAirPower = fleet.fullEscortAirPower;
		fleet.unionAirPower = fleet.fullUnionAirPower;
	}

	// 出撃後スロット数の統計
	let n = 0;
	for (let i = 0; i < fleetLen; i++) {
		const ship = fleet.ships[i];
		for (let j = 0; j < ship.planes.length; j++) {
			const s = slotResults[n];
			const tmp =
			{
				shipNo: ship.fleetNo,
				slot: ship.planes[j].slotNo,
				max: getArrayMax(s),
				min: getArrayMin(s),
				avg: s.reduce((t, v) => t + v) / maxCount,
				death: s.filter(v => v === 0).length,
				deathRate: 0,
			};
			tmp.deathRate = tmp.death / s.length;
			resultData.fleetSlots.push(tmp);

			n++;
		}
	}

	// 各戦闘搭載、制空値などの平均値の表示
	for (let i = 0; i < maxBattle; i++) {
		const avgAP = Math.round(avgMainAps[i] / maxCount);
		const avgEAP = Math.round(avgEnemyAps[i] / maxCount);
		const airIndex = getAirStatusIndex(avgAP, avgEAP);
		$('#shoot_down_table').find(`.fap.battle${i + 1}`).text(avgAP);
		$('#shoot_down_table').find(`.eap.battle${i + 1}`).text(avgEAP);
		$('#shoot_down_table').find(`.cond.battle${i + 1}`).text(AIR_STATUS[airIndex].abbr).addClass(`airStatus${airIndex}`);

		for (const ship of fleet.ships) {
			for (const plane of ship.planes) {
				if (plane.id) {
					const result = plane.results[i];
					$(`#shoot_down_table .shipNo${ship.fleetNo}.slot${plane.slotNo} .battle${i + 1}`).text(Math.round(result / maxCount));
				}
			}
		}
	}

	// 関係ない戦闘は省く
	$('#shoot_down_table').find('td').removeClass('d-none');
	for (let i = battleCount + 1; i <= 10; i++) {
		$('#shoot_down_table').find(`.battle${i}`).addClass('d-none');
	}

	if (!isDefMode) {
		resultData.fleetAirPower = Math.round(avgMainAps[mainBattle] / maxCount)
	}

	// 表示戦闘における各航空隊の状態を取得
	const airStatusDist = [];
	for (const landBase of landBaseData.landBases) {
		for (let i = 0; i < 2; i++) {
			airStatusDist.push(landBase.results[displayBattle - 1].airStatusIndex[i].map(v => v / maxCount));
		}
	}

	// それぞれの制空状態の総数を確率化して格納 基地は表示戦闘の各フェーズあり

	// 表示戦闘の基地開始制空値を格納
	for (const landBase of landBaseData.landBases) {
		resultData.landBaseAirPowers.push(Math.round(landBase.results[mainBattle].mainAirPower[0] / maxCount));
		resultData.landBaseAirPowers.push(Math.round(landBase.results[mainBattle].mainAirPower[1] / maxCount));
		resultData.enemyAirPowers.push(Math.round(landBase.results[mainBattle].enemyAirPower[0] / maxCount));
		resultData.enemyAirPowers.push(Math.round(landBase.results[mainBattle].enemyAirPower[1] / maxCount));
	}

	if (isDefMode) {
		resultData.enemyAirPowers.push(defEnemyAp);
	}
	else {
		resultData.enemyAirPowers.push(Math.round(avgEnemyAps[mainBattle] / maxCount));
	}
	resultData.landBaseAirStatus = airStatusDist;
	resultData.fleetAirStatus = fleetASDist.map(v => v / maxCount);
	resultData.enemySlots = enemySlotResult;
	resultData.enemyAirPowerResults = enemyAps;
	resultData.enemySlotAllDead = enemySlotAllDead;
	resultData.usedSteels = sumUsedSteels;

	return null;
}

/**
 * 指定された敵艦隊に対して基地攻撃を行う。
 * @param {LandBaseAll} landBaseData 基地航空隊オブジェクト
 * @param {Battle} battleInfo 被害者の会
 * @param {number} battleIndex 戦闘番号
 */
function calculateLandBase(landBaseData, battleInfo, battleIndex) {
	const enemyFleet = battleInfo.enemies;

	for (let j = 0; j < 3; j++) {
		const landBase = landBaseData.landBases[j];
		const wave1 = landBase.target[0];
		const wave2 = landBase.target[1];

		if (wave1 !== battleIndex && wave2 !== battleIndex) {
			// 1派目 2派目ともに対象でないなら飛ばす
			continue;
		}
		const result = landBase.results[battleIndex];

		// 出撃第一波
		if (wave1 === battleIndex) {
			// 噴式強襲フェーズ
			doLandBaseJetPhase(landBase, battleInfo);

			let lbAp = landBase.airPower;

			const eap = battleInfo.getLandBaseAirPower();
			// 双方制空値0の場合は確保扱い
			const airStatusIndex = (lbAp === 0 && eap === 0) ? 0 : getAirStatusIndex(lbAp, eap);

			// 結果の格納
			result.airStatusIndex[0][airStatusIndex]++;
			result.mainAirPower[0] += lbAp;
			result.enemyAirPower[0] += eap;

			// 敵機削り
			shootDownEnemy(airStatusIndex, enemyFleet);

			// 派遣先が違う場合は被害を起こす
			if (wave1 !== wave2) {
				shootDownLandBase(airStatusIndex, landBase, battleInfo);
			}
		}

		// 出撃第二波
		if (wave2 === battleIndex) {

			// 派遣先が違う場合は噴式強襲フェーズ起こす
			if (wave1 !== wave2) {
				doLandBaseJetPhase(landBase, battleInfo);
			}

			let lbAp = landBase.airPower;

			const eap = battleInfo.getLandBaseAirPower();
			const airStatusIndex = (lbAp === 0 && eap === 0) ? 0 : getAirStatusIndex(lbAp, eap);

			// 結果の格納
			result.airStatusIndex[1][airStatusIndex]++;
			result.mainAirPower[1] += lbAp;
			result.enemyAirPower[1] += eap;

			// 敵機削り
			shootDownEnemy(airStatusIndex, enemyFleet);

			// 派遣先が違う場合は被害を起こす
			if (wave1 !== wave2) {
				shootDownLandBase(airStatusIndex, landBase, battleInfo);
			}
		}
	}
}

/**
 * 詳細結果表示
 */
function detailCalculate() {
	const baseNo = castInt($('#detail_info').data('base_no'));
	const slot = castInt($('#detail_info').data('slot_no'));
	// 計算する対象の取得
	switch ($('#detail_info').data('mode')) {
		case "enemy_slot_detail":
			enemySlotDetailCalculate(baseNo, slot);
			break;
		case "fleet_slot_detail":
			fleetSlotDetailCalculate(baseNo, slot, castInt($('#detail_info').data('ship_id')));
			break;
		case "land_base_detail":
			landBaseDetailCalculate(baseNo, slot);
			break;
		default:
			break;
	}
}

/**
 * 味方スロット撃墜数詳細計算
 * @param {number} shipNo
 * @param {number} slotNo
 * @param {number} shipId
 */
function fleetSlotDetailCalculate(shipNo, slotNo, shipId = 0) {
	// 事前計算テーブルチェック
	setPreCalculateTable();

	// 基地オブジェクト取得
	const landBaseData = createLandBaseInstance(false);
	// 味方艦隊オブジェクト取得
	const fleet = createFleetInstance(false);
	// 戦闘情報オブジェクト取得
	const battleInfo = updateEnemyFleetInfo(false);
	// 計算回数
	const maxCount = castInt($('#detail_calculate_count').val());
	// 表示戦闘
	let mainBattle = isDefMode ? 0 : (displayBattle - 1);
	// チャート用散布
	const data = [];
	// 今回の記録用の味方データ
	const shipInstance = fleet.ships[shipNo];
	const plane = PLANE_DATA.find(v => v.id === shipInstance.planes[slotNo].id);
	// 例外排除
	mainBattle = mainBattle < battleInfo.battles.length ? mainBattle : battleInfo.battles.length - 1;

	// 航空戦火力式 機体の種類別倍率 × (機体の雷装 or 爆装 × √搭載数 + 25)
	const rate = Math.abs(plane.type) === 2 ? [0.8, 1.5] : ATTACKERS.includes(plane.type) ? [1] : [0];
	const remodel = shipInstance.planes[slotNo].remodel;

	let fire = 0;
	switch (plane.type) {
		case 2:
		case -2:
			fire = Plane.getBonusTorpedo(plane.type, remodel) + plane.torpedo;
			break;
		case 3:
		case 6:
			fire = Plane.getBonusBomber(plane.type, remodel, plane.antiAir) + plane.bomber;
			break;
		default:
			break;

	}
	// 搭載数のない敵艦を全て除外(stage2テーブルは生成済み)
	for (const info of battleInfo.battles) {
		info.enemies = info.enemies.filter(v => v.slots.length > 0);
	}

	for (let count = 0; count < maxCount; count++) {

		// 道中含めてブン回し
		for (let battle = 0; battle < battleCount; battle++) {
			const thisBattleInfo = battleInfo.battles[battle];
			const enemies = thisBattleInfo.enemies;

			// 基地戦闘
			calculateLandBase(landBaseData, thisBattleInfo, battle);

			// 噴式強襲フェーズ
			doJetPhase(fleet, thisBattleInfo);

			const cellType = thisBattleInfo.cellType;
			const fap = cellType !== CELL_TYPE.grand ? fleet.airPower : fleet.unionAirPower;
			const eap = thisBattleInfo.getAirPower();
			const airIndex = getAirStatusIndex(fap, eap);

			// 味方st1 & st2
			shootDownFriend(airIndex, fleet, thisBattleInfo, battle);

			// 敵機補給
			for (const enemy of enemies) {
				enemy.slots = enemy.fullSlots.concat();
				enemy.airPower = enemy.fullAirPower;
				enemy.landBaseAirPower = enemy.fullLandBaseAirPower;
			}
		}

		// 基地の補給
		for (let i = 0; i < 3; i++) {
			const landBase = landBaseData.landBases[i];
			for (let j = 0; j < landBase.planes.length; j++) {
				const plane = landBase.planes[j];
				plane.slot = plane.fullSlot;
				plane.updateAirPower();
			}
			landBase.updateAirPower();
		}

		// カーソル
		// 自艦隊各種スロット清算、補給
		for (let i = 0; i < fleet.ships.length; i++) {
			const ship = fleet.ships[i];
			const planesLen = ship.planes.length;
			ship.airPower = 0;
			for (let j = 0; j < planesLen; j++) {
				const plane = ship.planes[j];
				if (i === shipNo && plane.slotNo === slotNo) {
					data.push(plane.slot);
				}
				plane.slot = plane.fullSlot;
				plane.updateAirPower();

				ship.airPower += plane.airPower;
			}
		}
		fleet.updateAirPower();
	}

	const tooltips = {
		mode: 'index',
		callbacks: {
			title: (tooltipItem, data) => {
				const value = tooltipItem[0].xLabel;
				if (!value) return `残機数：${value} 機${'\n'}航空戦火力：0`;
				const af = Math.floor(rate[0] * (fire * Math.sqrt(value) + 25));
				const af2 = rate.length === 2 ? Math.floor(rate[1] * (fire * Math.sqrt(value) + 25)) : 0;
				const ap = `航空戦火力：${af}${af2 ? ` or ${af2}` : ''}`
				return `残機数：${value} 機${'\n' + ap}`;
			},
			label: (tooltipItem, data) => [`${tooltipItem.yLabel} %`],
		}
	}
	// グラフ描画
	updateDetailChart(data, '残機数 [機]', tooltips);

	// 説明表示
	const ship = SHIP_DATA.find(v => v.id === shipId);
	let planeText = '';
	let index = 0;

	$('#land_base_detail_table').addClass('d-none');
	$('.detail_fire').addClass('d-none').removeClass('d-flex');
	$('.detail_wave').addClass('d-none').removeClass('d-flex');
	$('#detail_info').data('mode', 'fleet_slot_detail');
	$('#detail_info').data('ship_id', shipId);
	$('#detail_info').data('base_no', shipNo);
	$('#detail_info').data('slot_no', slotNo);
	const warningText = `
		<div>※ 航空戦火力はキャップ前でクリティカル補正、触接補正なし。小数切捨て</div>
		<div>※ 最終戦闘の航空戦終了時点での残数の分布を表示しています。</div>`;
	$('#detail_warning').html(warningText);

	for (const pl of shipInstance.planes) {
		const p = PLANE_DATA.find(v => v.id === pl.id);
		if (index === (ship ? ship.slot.length : 4)) break;
		const name = p ? (p.abbr ? p.abbr : p.name) : '-';
		planeText += `
		<div class="row mx-1 py-0_5 ${slotNo === index ? 'selected' : ''} ${p ? `general_tr btn_show_detail` : ''}" data-slot_no="${index}">
			<div class="col-1 align-self-center font_size_11 text-left">${index + 1}</div>
			<div class="col d-flex align-self-center font_size_12 pl-0">
				<img src="../img/type/${p ? `type${p.type}` : 'undefined'}.png" class="plane_img_sm align-self-center">
				<div class="align-self-center">${name}</div>
			</div>
			<div class="col font_size_11 align-self-center">
				${p ? (`(搭載: ${pl.slot}機${p.torpedo ? `　雷装: ${p.torpedo}` : ''}${p.bomber ? `　爆装: ${p.bomber}` : ''})`) : ''}
			</div>
		</div>`;
		index++;
	}

	const detailLegend = `
		<img src="../img/ship/${shipId}.png" class="ship_img align-self-center ${shipId ? '' : 'd-none'}">
		<span class="ml-1 align-self-center legend_name" data-shipid="${shipId}">${ship ? ship.name : '未指定'}</span>
	`;

	$('#detail_legend').html(detailLegend);
	$('#detail_info').html(planeText);
}


/**
 * 基地航空隊詳細計算
 * @param {number} landBaseNo 基地航空隊番号
 * @param {number} slotNo スロット番号
 */
function landBaseDetailCalculate(landBaseNo, slotNo) {
	// 事前計算テーブルチェック
	setPreCalculateTable();
	// 基地オブジェクト取得
	const landBaseData = createLandBaseInstance(false);
	// 戦闘情報オブジェクト取得
	const battleInfo = updateEnemyFleetInfo(false);
	// 計算回数
	const maxCount = castInt($('#detail_calculate_count').val());
	// チャート用散布
	const data = [];
	// 表示戦闘
	let mainBattle = isDefMode ? 0 : (displayBattle - 1);

	// 各隊の機体
	const planes = landBaseData.landBases[landBaseNo].planes;
	// 元の全機数
	let suppliedSlot = 0;

	// 有効なスロットかチェック & 元の全機数チェック
	for (let index = 0; index < planes.length; index++) {
		const plane = planes[index];
		if (planes[slotNo].id === 0 && plane.id !== 0) slotNo = index;
		suppliedSlot += plane.fullSlot;
	}

	// 撃墜された数を記録
	const aliveCount = [];

	for (let count = 0; count < maxCount; count++) {

		// 道中含めて表示戦闘までブン回し
		for (let battle = 0; battle <= mainBattle; battle++) {
			const thisBattleInfo = battleInfo.battles[battle];
			const enemies = thisBattleInfo.enemies;

			for (let j = 0; j < 3; j++) {
				const landBase = landBaseData.landBases[j];
				const wave1 = landBase.target[0];
				const wave2 = landBase.target[1];

				if (wave1 !== battle && wave2 !== battle) {
					// 1派目 2派目ともに対象でないなら飛ばす
					continue;
				}

				// 出撃第一波
				if (wave1 === battle) {
					// 噴式強襲フェーズ
					doLandBaseJetPhase(landBase, thisBattleInfo);

					const lbAp = landBase.airPower;
					const eap = thisBattleInfo.getLandBaseAirPower();
					// 双方制空値0の場合は確保扱い
					const airStatusIndex = (lbAp === 0 && eap === 0) ? 0 : getAirStatusIndex(lbAp, eap);

					// 敵機削り
					shootDownEnemy(airStatusIndex, enemies);

					if (wave1 !== wave2) {
						// 基地削られ
						shootDownLandBase(airStatusIndex, landBase, thisBattleInfo);
					}
				}

				// 出撃第二波
				if (wave2 === battle) {

					if (wave1 !== wave2) {
						// 噴式強襲フェーズ
						doLandBaseJetPhase(landBase, thisBattleInfo);
					}

					const lbAp = landBase.airPower;

					const eap = thisBattleInfo.getLandBaseAirPower();
					const airStatusIndex = (lbAp === 0 && eap === 0) ? 0 : getAirStatusIndex(lbAp, eap);

					// 敵機削り
					shootDownEnemy(airStatusIndex, enemies);

					// 基地削られ
					shootDownLandBase(airStatusIndex, landBase, thisBattleInfo);
				}
			}

			// 敵機補給
			for (const enemy of enemies) {
				enemy.slots = enemy.fullSlots.concat();
				enemy.airPower = enemy.fullAirPower;
				enemy.landBaseAirPower = enemy.fullLandBaseAirPower;
			}
		}

		// 基地の補給
		for (let i = 0; i < 3; i++) {
			const landBase = landBaseData.landBases[i];
			let sumAlive = 0;
			for (let j = 0; j < landBase.planes.length; j++) {
				const plane = landBase.planes[j];
				if (landBaseNo + 1 === landBase.baseNo && slotNo + 1 === plane.slotNo) {
					data.push(plane.slot);
				}
				sumAlive += plane.slot;
				plane.slot = plane.fullSlot;
				plane.updateAirPower();
			}

			if (landBaseNo + 1 === landBase.baseNo) {
				aliveCount.push(sumAlive);
			}
			landBase.updateAirPower();
		}
	}

	// 機体id
	const planeId = planes[slotNo].id;
	// 改修値
	const remodel = planes[slotNo].remodel;
	// 陸偵補正：二式陸偵 = 1.125、二式陸偵(熟練) = 1.15
	const adj2 = planes.find(v => v.id === 312) ? 1.15 : planes.find(v => v.id === 311) ? 1.125 : 1.0;
	// 敵連合特効：対敵通常艦隊 = 1.0、対敵連合艦隊 = 1.1
	const adj3 = battleInfo.cellType === CELL_TYPE.grand ? 1.1 : 1.0;
	const tooltips = {
		mode: 'index',
		callbacks: {
			title: (tooltipItem, data) => {
				const value = tooltipItem[0].xLabel;
				const last = getLandBasePower(planeId, value, remodel) * adj2 * adj3;
				const ap = `航空戦火力：${last.toFixed(1)}`
				if (!value) return `残機数：0 機${'\n'}航空戦火力：0`;
				else return `残機数：${value} 機${'\n' + ap}`;
			},
			label: (tooltipItem, data) => [`${tooltipItem.yLabel} %`],
		}
	}
	// グラフ描画
	updateDetailChart(data, '残機数 [機]', tooltips);

	// 未帰還機多数とかのアレ
	let count1 = 0;
	let count2 = 0;
	let count3 = 0;

	for (const v of aliveCount) {
		// 生存率
		const aliveRate = v / suppliedSlot;
		if (v === 0) count3++;
		else if (aliveRate < 0.25) count2++;
		else if (aliveRate < 0.4) count1++;
	}
	$('#status_s').text((100 * count1 / maxCount) + ' %');
	$('#status_m').text((100 * count2 / maxCount) + ' %');
	$('#status_l').text((100 * count3 / maxCount) + ' %');

	// 説明表示
	let planeText = '';
	let index = 0;

	$('#land_base_detail_table').removeClass('d-none');
	$('.detail_fire').addClass('d-none').removeClass('d-flex');
	$('.detail_wave').removeClass('d-none').addClass('d-flex');
	$('#detail_info').data('mode', 'land_base_detail');
	$('#detail_info').data('base_no', landBaseNo);
	$('#detail_info').data('slot_no', slotNo);
	const warningText = `
		<div>※ 航空戦火力はクリティカル補正、触接補正なしで対水上艦の場合</div>
		<div>※ 対敵連合補正、陸偵補正については、該当する戦闘、装備であれば有効</div>`;
	$('#detail_warning').html(warningText);

	for (const pl of landBaseData.landBases[landBaseNo].planes) {
		const p = PLANE_DATA.find(v => v.id === pl.id);
		const name = p ? (p.abbr ? p.abbr : p.name) : '-';
		planeText += `
		<div class="row mx-1 py-0_5 ${slotNo === index ? 'selected' : ''} ${p ? `general_tr btn_show_detail` : ''}" data-slot_no="${index}">
			<div class="col-1 align-self-center font_size_11 text-left">${index + 1}</div>
			<div class="col d-flex align-self-center font_size_12 pl-0">
				<img src="../img/type/${p ? `type${p.type}` : 'undefined'}.png" class="plane_img_sm align-self-center">
				<div class="align-self-center">${name}</div>
			</div>
			<div class="col font_size_11 align-self-center">
				${p ? (`(搭載: ${pl.slot}機${p.torpedo ? `　雷装: ${p.torpedo}` : ''}${p.bomber ? `　爆装: ${p.bomber}` : ''})`) : ''}
			</div>
		</div>`;
		index++;
	}

	$('#detail_legend').html(`<span>第${landBaseNo + 1}基地航空隊</span>`);
	$('#detail_info').html(planeText);
}

/**
 * 敵スロット撃墜数詳細計算
 */
function enemySlotDetailCalculate(enemyNo, slotNo) {
	// 事前計算テーブルチェック
	setPreCalculateTable();
	// 基地オブジェクト取得
	const landBaseData = createLandBaseInstance(false);
	// 味方艦隊オブジェクト取得
	const fleet = createFleetInstance(false);
	// 戦闘情報オブジェクト取得
	const battleInfo = updateEnemyFleetInfo(false);
	// 計算回数
	const maxCount = castInt($('#calculate_count').val());
	// 表示戦闘
	let mainBattle = isDefMode ? 0 : (displayBattle - 1);
	// 例外排除
	mainBattle = mainBattle < battleInfo.battles.length ? mainBattle : battleInfo.battles.length - 1;
	// チャート用散布
	const data = [];
	// 今回の記録用の敵データ
	const targetEnemy = battleInfo.battles[mainBattle].enemies.filter(v => v.slots.length > 0 && !v.onlyScout)[enemyNo];
	const enemy = ENEMY_DATA.find(v => v.id === targetEnemy.id);
	const plane = ENEMY_PLANE_DATA.find(v => v.id === enemy.eqp[slotNo]);

	// 航空戦火力式 機体の種類別倍率 × (機体の雷装 or 爆装 × √搭載数 + 25)
	const rate = Math.abs(plane.type) === 2 ? [0.8, 1.5] : Math.abs(plane.type) === 1 ? [0] : [1];
	const fire = Math.abs(plane.type) === 2 ? plane.torpedo : plane.bomber;

	// 搭載表示 or 航空戦火力表示
	const isSlotDetail = $('#slot_detail').prop('checked');

	const st2 = fleetStage2Table.concat();
	const enabledSt2 = !document.getElementById('ignore_stage2')['checked'] && st2.length > 0;

	// 搭載数のない敵艦を全て除外(stage2テーブルは生成済み)
	for (const info of battleInfo.battles) {
		info.enemies = info.enemies.filter(v => v.slots.length > 0);
	}

	for (let count = 0; count < maxCount; count++) {

		// 表示戦闘まで道中含めてブン回し
		for (let battle = 0; battle <= mainBattle; battle++) {
			const thisBattleInfo = battleInfo.battles[battle];
			const enemies = thisBattleInfo.enemies;

			// 基地戦闘
			calculateLandBase(landBaseData, thisBattleInfo, battle);

			// 噴式強襲フェーズ
			doJetPhase(fleet, thisBattleInfo);

			const cellType = thisBattleInfo.cellType;
			const fap = cellType !== CELL_TYPE.grand ? fleet.airPower : fleet.unionAirPower;
			const eap = thisBattleInfo.getAirPower();
			const airIndex = getAirStatusIndex(fap, eap);

			// 味方st1 & st2
			shootDownFriend(airIndex, fleet, thisBattleInfo, battle);

			// 表示戦闘の敵搭載数記録
			if (battle === mainBattle) {
				// 敵st1 & st2
				shootDownEnemy(airIndex, enemies, enabledSt2, st2);

				if (isSlotDetail) {
					// 指定した敵とスロットの数を格納
					data.push(targetEnemy.slots[slotNo]);
				}
				else {
					// 航空戦火力
					if (targetEnemy.slots[slotNo]) {
						data.push(Math.floor(rate[Math.floor(Math.random() * rate.length)] * (fire * Math.sqrt(targetEnemy.slots[slotNo]) + 25)));
					}
					else {
						data.push(0);
					}
				}
			}

			// 補給
			for (let i = 0; i < enemies.length; i++) {
				const enemy = enemies[i];
				if (enemy.onlyScout) continue;
				enemy.slots = enemy.fullSlots.concat();
				enemy.airPower = enemy.fullAirPower;
				enemy.landBaseAirPower = enemy.fullLandBaseAirPower;
			}
		}

		// 基地の補給
		for (let i = 0; i < 3; i++) {
			const landBase = landBaseData.landBases[i];
			for (let j = 0; j < landBase.planes.length; j++) {
				const plane = landBase.planes[j];
				plane.slot = plane.fullSlot;
				plane.updateAirPower();
			}
			landBase.updateAirPower();
		}

		// 自艦隊各種スロット清算、補給
		for (let i = 0; i < fleet.ships.length; i++) {
			const ship = fleet.ships[i];
			const planesLen = ship.planes.length;
			ship.airPower = 0;
			for (let j = 0; j < planesLen; j++) {
				const plane = ship.planes[j];
				plane.slot = plane.fullSlot;
				plane.updateAirPower();

				ship.airPower += plane.airPower;
			}
		}
		fleet.updateAirPower();
	}

	const label = isSlotDetail ? '残機数 [機]' : '航空戦火力';
	const tooltips = {
		mode: 'index',
		callbacks: {
			title: (tooltipItem, data) => {
				const value = tooltipItem[0].xLabel;
				if ($('#slot_detail').prop('checked')) {
					if (!value) return `残機数：${value} 機${'\n'}航空戦火力：0`;
					const af = Math.floor(rate[0] * (fire * Math.sqrt(value) + 25));
					const af2 = rate.length === 2 ? Math.floor(rate[1] * (fire * Math.sqrt(value) + 25)) : 0;
					const ap = `航空戦火力：${af}${af2 ? ` or ${af2}` : ''}`
					return `残機数：${value} 機${'\n' + ap}`;
				}
				else return `航空戦火力：${value}`;
			},
			label: (tooltipItem, data) => [`${tooltipItem.yLabel} %`],
		}
	}

	// 描画
	updateDetailChart(data, label, tooltips);

	// 必要なら説明表示
	$('#land_base_detail_table').addClass('d-none');
	$('.detail_fire').removeClass('d-none').addClass('d-flex');
	$('.detail_wave').addClass('d-none').removeClass('d-flex');
	$('#detail_info').data('mode', 'enemy_slot_detail');
	$('#detail_info').data('base_no', enemyNo);
	$('#detail_info').data('slot_no', slotNo);
	$('#detail_info').data('battle_no', mainBattle);
	$('#detail_warning').text('※ 航空戦火力はキャップ前でクリティカル、触接補正なし小数切捨て');

	let planeText = '';
	let index = 0;
	for (const id of enemy.eqp) {
		const p = ENEMY_PLANE_DATA.find(v => v.id === id);
		planeText += `
		<div class="row mx-1 py-0_5 ${slotNo === index ? 'selected' : ''} ${p ? `general_tr btn_show_detail` : ''}" data-slot_no="${index}">
			<div class="col-1 align-self-center font_size_11 text-left">${index + 1}</div>
			<div class="col d-flex align-self-center">
				<img src="../img/type/type${p.type}.png" class="plane_img_sm align-self-center">
				<div class="align-self-center">${p.name}</div>
			</div>
			<div class="col font_size_12 align-self-center">
				(搭載: ${targetEnemy.slots[index++]}機${p.torpedo ? `　雷装: ${p.torpedo}` : ''}${p.bomber ? `　爆装: ${p.bomber}` : ''})</span>
			</div>
		</div>`;
	}

	const detailLegend = `
		<img src="../img/enemy/${enemy.id}.png" class="ship_img align-self-center">
		<span class="ml-1 text-primary font_size_11 align-self-center">ID: ${enemy.id + 1500}</span>
		<span class="ml-1 align-self-center legend_name" data-enemyid="${enemy.id}">${enemy.name}</span>
	`;

	$('#detail_legend').html(detailLegend);
	$('#detail_info').html(planeText);
}


/**
 * グラフ更新 なければ作成
 * @param {Array.<number>} data 表示データセット
 * @param {string} xLabelString x軸
 * @param {object} tooltips ツールチップオブジェクト
 */
function updateDetailChart(data, xLabelString, tooltips) {
	// 描画
	const xLabels = [], actualData = [], rateData = [];
	const max_i = getArrayMax(data);
	const min_i = getArrayMin(data);
	const maxCount = data.length;
	let par50 = 0, par90 = 0, par95 = 0, par99 = 0, sumRate = 0;
	for (let i = min_i; i <= max_i; i++) {
		const num = data.filter(v => v === i).length;
		if (!num) continue;
		xLabels.push(i);
		actualData.push((100 * num / maxCount).toFixed(maxCount >= 100000 ? 5 : maxCount >= 10000 ? 4 : maxCount >= 1000 ? 3 : 2));
		sumRate += 100 * num / maxCount;
		rateData.push(sumRate.toFixed(1));
		if (!par50 && sumRate >= 50) par50 = i;
		if (!par90 && sumRate >= 90) par90 = i;
		if (!par95 && sumRate >= 95) par95 = i;
		if (!par99 && sumRate >= 99) par99 = i;
	}

	// 90%区間とか
	$('#detail_max').text(max_i);
	$('#detail_min').text(min_i);
	$('#detail_50').text(par50);
	$('#detail_90').text(par90);
	$('#detail_95').text(par95);
	$('#detail_99').text(par99);

	if (!chartInstance) {
		// 初回
		const ctx = document.getElementById("detailChart");

		const textColor = "rgba(" + hexToRGB(mainColor).join(',') + ", 0.8)";
		chartInstance = new Chart(ctx, {
			type: "bar",
			data: {
				labels: xLabels,
				datasets: [{
					label: "確率分布",
					data: actualData,
					borderColor: "rgb(255, 70, 100)",
					backgroundColor: "rgba(255, 120, 180, 0.4)",
					yAxisID: "y-axis-1",
				},
				{
					label: "累積確率",
					data: rateData,
					type: "line",
					fill: false,
					borderColor: "rgb(54, 162, 255)",
					yAxisID: "y-axis-2",
				}]
			},
			options: {
				responsive: true,
				scales: {
					xAxes: [{
						scaleLabel: { display: true, labelString: xLabelString, fontColor: textColor },
						gridLines: { display: false },
						ticks: { fontSize: 10, fontColor: textColor }
					}],
					yAxes: [{
						id: "y-axis-1",
						type: "linear",
						position: "left",
						gridLines: { display: true, color: "rgba(128, 128, 128, 0.2)" },
						scaleLabel: { display: true, labelString: '確率分布 [％]', fontColor: textColor },
						ticks: { min: 0, fontColor: textColor },
					},
					{
						id: "y-axis-2",
						type: "linear",
						position: "right",
						gridLines: { display: true, color: "rgba(128, 128, 128, 0.2)" },
						scaleLabel: { display: true, labelString: '累積確率 [％]', fontColor: textColor },
						ticks: { max: 100, min: 0, stepSize: 25, fontColor: textColor },
					}],
				},
				legend: {
					display: true,
					labels: { fontColor: textColor }
				},
				tooltips: tooltips
			}
		});
	}
	else {
		// グラフ更新
		chartInstance.data.labels = xLabels;
		chartInstance.data.datasets[0].data = actualData;
		chartInstance.data.datasets[1].data = rateData;
		chartInstance.options.scales.xAxes[0].scaleLabel.labelString = xLabelString;
		chartInstance.options.tooltips = tooltips;

		chartInstance.update();
	}
}


/**
 * 自動配備
 */
function autoExpand() {
	if ($('#mode_1').prop('checked')) {
		// 出撃モード
		toggleDefenseMode(false);
		autoExpandNormal();
	}
	else if ($('#mode_2').prop('checked') || $('#mode_3').prop('checked')) {
		// 防空モード
		toggleDefenseMode(true);
		autoExpandDefense();
	}

	calculate();
}

/**
 * 出撃時おまかせ配備
 */
function autoExpandNormal() {
	// 機体在庫
	const planeStock = loadPlaneStock();
	// 基地航空隊への艦戦の許可
	const allowFighter = $('#allow_fighter').prop('checked');
	// 自動配備対象
	const lb1 = $('#auto_land_base_1').prop('checked');
	const lb2 = $('#auto_land_base_2').prop('checked');
	const lb3 = $('#auto_land_base_3').prop('checked');
	const fleet = $('#auto_fleet').prop('checked');

	// 自動配備対象外のスロットから、装備されている機体を在庫から除く
	if (!lb1) {
		$('#lb_item1').find('.lb_plane').each((i, e) => {
			const stockData = planeStock.find(v => v.id === castInt($(e)[0].dataset.planeid));
			const remodel = castInt($(e).find('.remodel_value').text());
			if (stockData) stockData.num[remodel]--;
		});
	}
	if (!lb2) {
		$('#lb_item2').find('.lb_plane').each((i, e) => {
			const stockData = planeStock.find(v => v.id === castInt($(e)[0].dataset.planeid));
			const remodel = castInt($(e).find('.remodel_value').text());
			if (stockData) stockData.num[remodel]--;
		});
	}
	if (!lb3) {
		$('#lb_item3').find('.lb_plane').each((i, e) => {
			const stockData = planeStock.find(v => v.id === castInt($(e)[0].dataset.planeid));
			const remodel = castInt($(e).find('.remodel_value').text());
			if (stockData) stockData.num[remodel]--;
		});
	}

	// 本隊自動配備処理
	if (fleet) autoFleetExpand(planeStock);

	$('.ship_tab').find('.ship_plane').each((i, e) => {
		const stockData = planeStock.find(v => v.id === castInt($(e)[0].dataset.planeid));
		const remodel = castInt($(e).find('.remodel_value').text());
		if (stockData) stockData.num[remodel]--;
	});

	if (lb1 || lb2 || lb3) {
		// 利用可能機体群
		const planes = [];
		const minRange = castInt($('#dest_range').val());
		for (const stock of planeStock) {
			if (getArraySum(stock.num) <= 0) continue;
			const plane = PLANE_DATA.find(v => v.id === stock.id);
			// 半径足切り
			if (plane.radius < minRange) continue;
			// 対潜哨戒機 大型陸上機足切り
			if (plane.type === -101 || plane.type === 105) continue;
			// 艦戦非許容時艦戦足切り
			if (!allowFighter && Math.abs(plane.type) === 1) continue;
			// カテゴリ毎に分けて格納(艦戦系は合同)
			const typeName = 'type' + Math.abs(FIGHTERS.includes(plane.type) ? 1 : plane.type);
			if (!planes.hasOwnProperty(typeName)) planes[typeName] = [];

			// 在庫一斉追加
			for (let i = 0; i < stock.num.length; i++) {
				for (let j = 0; j < stock.num[i]; j++) {
					const planeData = {
						id: plane.id,
						type: plane.type,
						antiAir: (plane.antiAir + 1.5 * plane.interception),
						torpedo: plane.torpedo,
						bomber: plane.bomber,
						remodel: i,
					}
					planeData.antiAir = Plane.getBonusAntiAir(plane.id, plane.type, i, plane.antiAir);
					planes[typeName].push(planeData);
				}
			}
		}
		// 優先度ソート
		Object.keys(planes).forEach((key) => {
			// 艦戦系は出撃時対空値 → 半径ソート
			if (key === 'type1') {
				planes[key].sort((a, b) => { return a.antiAir === b.antiAir ? b.radius - a.radius : b.antiAir - a.antiAir; });
			}
			// 攻撃機系は雷装　→　対空ソート
			else if (key === 'type2') {
				planes[key].sort((a, b) => { return a.torpedo === b.torpedo ? b.radius - a.radius : b.torpedo - a.torpedo; });
			}
			// 陸攻は34型 → 雷装 → 対空ソート
			else if (key === 'type101') {
				planes[key].sort((a, b) => {
					if (a.id === 186 && b.id === 186) return b.antiAir - a.antiAir;
					else if (a.id === 186) return -1;
					else if (b.id === 186) return 1;
					else return a.torpedo === b.torpedo ? b.radius - a.radius : b.torpedo - a.torpedo;
				});
			}
			// 爆撃機系は爆装　→　対空ソート
			else if (['type3', 'type6'].includes(key)) {
				planes[key].sort((a, b) => { return a.bomber === b.bomber ? b.antiAir - a.antiAir : b.bomber - a.bomber; });
			}
			// 偵察機系は偵察　→　対空ソート
			else if (['type4', 'type5', 'type8', 'type104'].includes(key)) {
				planes[key].sort((a, b) => { return a.scout === b.scout ? b.antiAir - a.antiAir : b.scout - a.scout; });
			}
		});

		if (lb1) {
			const selectedPlanes = autoLandBaseExpand(planes);
			$('#lb_item1').find('.lb_plane').each((i, e) => { setLBPlaneDiv($(e), selectedPlanes[i]); });
			$('#lb_item1').find('.ohuda_select').val(selectedPlanes.length > 0 ? 2 : -1);
		}
		if (lb2) {
			const selectedPlanes = autoLandBaseExpand(planes);
			$('#lb_item2').find('.lb_plane').each((i, e) => { setLBPlaneDiv($(e), selectedPlanes[i]); });
			$('#lb_item2').find('.ohuda_select').val(selectedPlanes.length > 0 ? 2 : -1);
		}
		if (lb3) {
			const selectedPlanes = autoLandBaseExpand(planes);
			$('#lb_item3').find('.lb_plane').each((i, e) => { setLBPlaneDiv($(e), selectedPlanes[i]); });
			$('#lb_item3').find('.ohuda_select').val(selectedPlanes.length > 0 ? 2 : -1);
		}
	}
}

/**
 * 艦娘 目標制空値を満たすような配備
 */
function autoFleetExpand(planeStock) {
	// 目標制空値を取得
	const destAp = castInt($('#dest_ap').val());
	const $ship = $('.ship_tab[data-shipid!=""]');
	const allowFBA = !$('#no_FBA').prop('checked');

	// 利用可能機体群
	const planes = [];
	for (const stock of planeStock) {
		// 97艦攻 99艦爆 96艦戦 瑞雲 は無限
		if ([16, 19, 23, 26].includes(stock.id)) stock.num = [60, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
		if (getArraySum(stock.num) <= 0) continue;
		const plane = PLANE_DATA.find(v => v.id === stock.id);
		// 基地機体足切り
		if (plane.type > 100) continue;
		// カテゴリ毎に分けて格納(艦戦系は合同)
		const typeName = `type${Math.abs(FIGHTERS.includes(plane.type) ? 1 : plane.type)}`;
		if (!planes.hasOwnProperty(typeName)) planes[typeName] = [];

		// 在庫一斉追加
		for (let i = 0; i < stock.num.length; i++) {
			for (let j = 0; j < stock.num[i]; j++) {
				const planeData = {
					id: plane.id,
					type: plane.type,
					antiAir: (plane.antiAir + 1.5 * plane.interception),
					torpedo: plane.torpedo,
					bomber: plane.bomber,
					avoid: plane.avoid,
					remodel: i,
					stock: 1
				}
				planeData.antiAir += Plane.getBonusAntiAir(plane.id, plane.type, i, planeData.antiAir);
				planes[typeName].push(planeData);
			}
		}
	}
	// 優先度ソート
	Object.keys(planes).forEach((key) => {
		// 艦戦系は対空値ソート
		if (key === 'type1') {
			planes[key].sort((a, b) => b.antiAir - a.antiAir);
		}
		// 艦攻系は雷装値ソート
		else if (key === 'type2') {
			planes[key].sort((a, b) => a.torpedo === b.torpedo ? b.antiAir - a.antiAir : b.torpedo - a.torpedo);
		}
		// 爆装系は回避 → 爆装値ソート
		else if (['type3', 'type6'].includes(key)) {
			planes[key].sort((a, b) => a.avoid === b.avoid ? b.bomber - a.bomber : b.avoid - a.avoid);
		}
	});

	// 艦娘オブジェクト作成
	let fleetData = [];
	let orderIndex = 0;
	$ship.each((i, e) => {
		const ship = SHIP_DATA.find(v => v.id === castInt($(e)[0].dataset.shipid));
		if (ship) {
			const shipSlots = [];
			$(e).find('.ship_plane:not(.d-none)').each((i2, e2) => {
				const slotCount = castInt($(e2).find('.slot').text());
				const isLocked = $(e2).find('.plane_unlock').hasClass('d-none');
				const slotData = {
					shipId: ship.id,
					shipType: ship.type,
					slotNo: i2,
					num: slotCount,
					plane: new ShipPlane(0),
					order: orderIndex++,
					num_: slotCount,
					slotId: 'ship' + i + '_slot' + i2,
					isLock: isLocked,
					lockedPlane: null
				};

				if (isLocked) {
					const inputPlane = PLANE_DATA.find(v => v.id === castInt($(e2)[0].dataset.planeid));
					if (inputPlane) {
						const inputRemodel = castInt($(e2).find('.remodel_value').text());
						slotData.lockedPlane = { id: inputPlane.id, remodel: inputRemodel };
						// ロック済み機体があれば在庫から減らしておく
						Object.keys(planes).forEach((key) => {
							const deleteTraget = planes[key].findIndex(v => v.id === inputPlane.id && v.remodel === inputRemodel);
							if (deleteTraget > -1) {
								planes[key].splice(deleteTraget, 1);
							}
						});
					}
				}
				else if (slotCount === 0) {
					slotData.isLock = true;
				}

				// 空母以外は戦闘機系用にダミースロット数激減(20機以下の場合) 
				if (![1, 2, 3].includes(ship.type)) {
					slotData.num_ = slotCount - 100;
				}
				// 空母も小スロットは艦戦優先度上げる
				else if (slotCount < 10) {
					slotData.num_ = slotCount - 100;
				}
				shipSlots.push(slotData);
			});

			fleetData = fleetData.concat(shipSlots);
		}
	});

	// 攻撃機
	const atackers = [2, 6];
	let sumAp = 0;

	// 大スロ順に攻撃機積む(ダミースロットソート)
	fleetData.sort((a, b) => b.num_ - a.num_);
	for (const slotData of fleetData) {
		let equiped = false;
		for (let type of atackers) {
			// 装備ロックしていたらそいつを適用
			if (slotData.isLock) {
				if (slotData.lockedPlane) {
					const planeObj = getShipPlaneObject(slotData.num, slotData.lockedPlane);
					slotData.plane = planeObj;
					sumAp += planeObj.airPower;
				}
				equiped = true;
				break;
			}

			// 空母の2スロ目は艦爆を試行
			const shipType = slotData.shipType;
			if (allowFBA && ([1, 2, 3].includes(shipType)) && slotData.slotNo === 1) type = 3;
			for (const plane of planes['type' + type]) {
				if (plane.stock <= 0) continue;
				if (checkInvalidPlane(slotData.shipId, PLANE_DATA.find(v => v.id === plane.id))) {
					const planeObj = getShipPlaneObject(slotData.num, plane);
					slotData.plane = planeObj;
					sumAp += planeObj.airPower;
					plane.stock--;
					equiped = true;
					break;
				}
				else break;
			}
			if (equiped) break;
		}
	}

	// 全艦娘搭載数の昇順に並び替え(重巡級、戦艦級は搭載の反転値がソート基準となっている)
	fleetData.sort((a, b) => { return a.num_ === b.num_ ? b.slotNo - a.slotNo : a.num_ - b.num_; });
	const baseSumAp = sumAp;
	// 戦闘機の搭載が確定したスロット
	const fighterSlot = [];
	// 搭載が確定した艦載機 fighterSlot と連動
	let decidePlaneObjs = [];
	let tmpStockData = [];

	for (let i = 0; i < fleetData.length; i++) {
		// 制空を満たしたら終了
		if (sumAp >= destAp) break;

		// ロック済み機体飛ばし
		if (fleetData[i].isLock) continue;

		// 変更を戻す
		decidePlaneObjs = [];
		tmpStockData = [];
		for (const plane of planes['type1']) {
			tmpStockData.push({ id: plane.id, remodel: plane.remodel, antiAir: plane.antiAir, stock: plane.stock });
		}

		sumAp = baseSumAp;

		// 搭載確定スロに追加
		fighterSlot.push(fleetData[i]);
		// 搭載確定スロの降順に強艦戦を搭載した際の制空値を判定
		for (let j = fighterSlot.length - 1; j >= 0; j--) {
			const slotData = fighterSlot[j];
			let equiped = false;
			for (const plane of tmpStockData) {
				if (plane.stock <= 0) continue;
				if (checkInvalidPlane(slotData.shipId, PLANE_DATA.find(v => v.id === plane.id))) {
					const planeObj = getShipPlaneObject(slotData.num, plane);
					const prevAp = slotData.plane.airPower;
					if (prevAp < planeObj.airPower) {
						// 搭載確定機体に追加
						decidePlaneObjs.push(planeObj);
						sumAp += planeObj.airPower - prevAp;
						plane.stock--;
						equiped = true;
						break;
					}
				}
				if (equiped) break;
			}
			// 搭載する機体がないよ！ → 今ある機体をそのまま確定
			if (!equiped) {
				decidePlaneObjs.push(slotData.plane);
			}
		}
	}

	// 確定処理
	let equipedCount = 0;
	const decidePlaneCount = decidePlaneObjs.length;
	for (let i = 0; i < fleetData.length; i++) {
		if (fleetData[i].isLock) continue;
		if (equipedCount >= decidePlaneCount) break;

		// 確定機体ズの後ろから搭載
		fleetData[i].plane = decidePlaneObjs[(decidePlaneCount - 1) - equipedCount++];
	}

	// 元の順に戻す
	fleetData.sort((a, b) => a.order - b.order);

	// 実際に搭載
	orderIndex = 0;
	$ship.each((i, e) => {
		$(e).find('.ship_plane:not(.d-none)').each((i2, e2) => {
			const slotData = fleetData.find(v => v.slotId === ('ship' + i + '_slot' + i2));
			if (slotData) {
				setPlaneDiv($(e2), slotData.plane);
				orderIndex++;
			}
			else setPlaneDiv($(e2));
		});
	});
}

/**
 * 基地航空隊 出撃時 目標制空値を満たすような機体idを4つ取得する
 */
function autoLandBaseExpand(planes) {
	// 敵の制空値を取得
	const destAp = castInt($('#dest_ap').val());

	// 基地航空隊の攻撃機優先順位
	const atackers = [101, 105, 2, 3, 6, 9];
	// スロット
	const equipList = [
		new LandBasePlane(0),
		new LandBasePlane(0),
		new LandBasePlane(0),
		new LandBasePlane(0)
	];
	// スロット数
	const slotNumber = equipList.length;

	let sumAp = 0;
	let isMax = false;

	// 攻撃機系上位最大4つ取ってくる
	const selectedAttackers = [];
	for (const type of atackers) {
		const planeList = planes['type' + type];
		if (!planeList || planeList.length === 0) continue;
		for (let i = 0; i < planeList.length; i++) {
			const plane = planeList[i];
			selectedAttackers.push(plane);
			isMax = selectedAttackers.length === slotNumber;
			if (isMax) break;
		}
		if (isMax) break;
	}

	// スロット下から攻撃機搭載
	for (let i = 0; i < selectedAttackers.length; i++) {
		const plane = getLandBasePlaneObject(selectedAttackers[i]);
		equipList[(equipList.length - 1) - i] = plane;
		sumAp += plane.airPower;
	}

	// 満載かつ制空が足りてるなら終了
	if (isMax && sumAp >= destAp) {
		const selectedPlanes = [];
		for (const v of equipList) {
			selectedPlanes.push({ id: v.id, remodel: v.remodel });

			// 在庫から減らす
			for (const plane of selectedPlanes) {
				Object.keys(planes).forEach((key) => {
					const deleteTraget = planes[key].findIndex(v => v.id === plane.id && v.remodel === plane.remodel);
					if (deleteTraget > -1) {
						planes[key].splice(deleteTraget, 1);
					}
				});
			}
		}
		return selectedPlanes;
	}

	// 艦戦系上位4つ取ってくる
	const selectedFighters = [];
	isMax = false;
	const planeList = planes['type1'];
	if (planeList) {
		for (let i = 0; i < planeList.length; i++) {
			const plane = planeList[i];
			selectedFighters.push(plane);
			isMax = selectedFighters.length === slotNumber;
			if (isMax) break;
		}
	}

	// 制空値を満たすまで艦戦系を追加
	for (let i = 0; i < selectedFighters.length; i++) {
		// 元の機体の制空値
		const prevAp = equipList[i].airPower;
		const newPlane = getLandBasePlaneObject(selectedFighters[i]);
		// 元の制空値を上回るなら搭載
		if (prevAp < newPlane.airPower) {
			equipList[i] = newPlane;
			sumAp += equipList[i].airPower - prevAp;
		}
		if (sumAp >= destAp) break;
	}

	const selectedPlanes = [];
	for (const v of equipList) {
		if (v) selectedPlanes.push({ id: v.id, remodel: v.remodel });
	}
	// 在庫から減らす
	for (const plane of selectedPlanes) {
		Object.keys(planes).forEach((key) => {
			const deleteTraget = planes[key].findIndex(v => v.id === plane.id && v.remodel === plane.remodel);
			if (deleteTraget > -1) {
				planes[key].splice(deleteTraget, 1);
			}
		});
	}
	return selectedPlanes;
}

/**
* 基地スロットオブジェクト返却
 * @param {object} plane 機体
 * @returns {LandBasePlane}
 */
function getLandBasePlaneObject(plane) {
	const rawPlane = PLANE_DATA.find(v => v.id === plane.id);
	const level = setting.defaultProf.find(v => v.id === Math.abs(rawPlane.type)).prof;
	return new LandBasePlane(plane.id, 18, plane.remodel, level);
}

/**
 * 艦娘スロットオブジェクト返却
 * @param {number} slotCount 搭載数
 * @param {object} plane 機体
 * @returns {ShipPlane}
 */
function getShipPlaneObject(slotCount, plane) {
	const rawPlane = PLANE_DATA.find(v => v.id === plane.id);
	const level = setting.defaultProf.find(v => v.id === Math.abs(rawPlane.type)).prof;
	return new ShipPlane(plane.id, slotCount, plane.remodel, level);
}

/**
 * 防空時おまかせ配備
 */
function autoExpandDefense() {
	// 自動配備対象
	const lb1 = $('#auto_land_base_1').prop('checked');
	const lb2 = $('#auto_land_base_2').prop('checked');
	const lb3 = $('#auto_land_base_3').prop('checked');

	// 基地いったん全解除
	$('.lb_plane').each((i, e) => { setLBPlaneDiv($(e)) });

	// 参加部隊数
	let count = 0;
	if (lb1) count++;
	if (lb2) count++;
	if (lb3) count++;

	if (count > 0) {
		const lbData = autoLandBaseExpandDef(count);

		if (lb1) {
			const planes = lbData[0].planes;
			$('#lb_item1').find('.lb_plane').each((i, e) => { setLBPlaneDiv($(e), planes[i]); });
			$('#lb_item1').find('.ohuda_select').val(0);
		}
		if (lb2) {
			const planes = lbData[lb1 ? 1 : 0].planes;
			$('#lb_item2').find('.lb_plane').each((i, e) => { setLBPlaneDiv($(e), planes[i]); });
			$('#lb_item2').find('.ohuda_select').val(0);
		}
		if (lb3) {
			const planes = lbData[lb1 && lb2 ? 2 : lb1 || lb2 ? 1 : 0].planes;
			$('#lb_item3').find('.lb_plane').each((i, e) => { setLBPlaneDiv($(e), planes[i]); });
			$('#lb_item3').find('.ohuda_select').val(0);
		}
	}
}

/**
 * 基地航空隊 防空　おまかせ配備
 * @param {number} count 参加部隊数
 */
function autoLandBaseExpandDef(count) {
	// 目標制空値
	const destAp = castInt($('#dest_ap').val());
	// 機体在庫
	const planeStock = loadPlaneStock();
	// 重爆フラグ
	const isHeavyDef = $('#mode_3').prop('checked');
	// 利用可能機体群 最大12機取得
	let planes = [];
	const recons = [];
	const maxSlot = 4 * count;
	for (const stock of planeStock) {
		// 96艦戦、零式水偵無印は無限
		if (stock.id === 25 || stock.id === 19) stock.num = [maxSlot, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
		if (getArraySum(stock.num) <= 0) continue;
		const plane = PLANE_DATA.find(v => v.id === stock.id);
		// 偵察機系のみ別
		if (RECONNAISSANCES.includes(plane.type)) {
			// 水偵は無限
			for (let i = 10; i >= 0; i--) {
				if (stock.num[i] < 1) continue;
				const v = {
					id: plane.id,
					antiAir: plane.antiAir,
					type: plane.type,
					adjust: 1,
					scout: plane.scout,
					remodel: i
				};
				v.adjust = getReconnaissancesAdjust(v, true);
				for (let j = 0; j < stock.num[i]; j++) {
					recons.push(v);
				}
			}
		}
		else {
			for (let i = 10; i >= 0; i--) {
				if (stock.num[i] < 1) continue;
				const v = {
					id: plane.id,
					type: plane.type,
					remodel: i,
					antiAir: (plane.antiAir + plane.interception + 2.0 * plane.antiBomber),
					interception: plane.interception,
					antiBomber: plane.antiBomber,
					isRocket: 0
				};
				v.antiAir += Plane.getBonusAntiAir(v.id, v.type, v.remodel, v.antiAir);

				if (v.antiAir === 0) continue;
				for (let j = 0; j < stock.num[i]; j++) {
					// オブジェクトの値のみコピー
					planes.push(Object.assign({}, v));
				}
			}
		}
	}

	// 重爆防空　ロケット上位3つだけ最優先 → 残りは対空ソート
	if (isHeavyDef) {
		// 通常の対空値ソート
		planes.sort((a, b) => b.antiAir - a.antiAir);
		// 上位3つのロケット戦闘機のフラグを上げる
		for (let i = 0; i < 3; i++) {
			const index = planes.findIndex(v => v.isRocket === 0 && ROCKETS.includes(v.id));
			if (index > -1) planes[index].isRocket = 1;
		}
		// あげたフラグでソート
		planes.sort((a, b) => b.isRocket - a.isRocket);
	}
	else {
		// 対空値ソート
		planes.sort((a, b) => { return a.antiAir === b.antiAir ? b.radius - a.radius : b.antiAir - a.antiAir; });
	}
	// 偵察機ソート(艦偵 陸偵 水偵)
	recons.sort((a, b) => { return b.adjust === a.adjust ? b.scout - a.scout : b.adjust - a.adjust; });
	// スロット総数の上位機体取得
	planes = planes.filter((v, i) => i < count * 4);

	// 装備リスト
	const equipList = [];
	// 初期化
	for (let i = 0; i < count; i++) {
		const ini = { ap: 0, planes: [] };
		for (let j = 0; j < 4; j++) ini.planes.push({ id: 0 });
		equipList.push(ini);
	}

	// 全航空隊総制空値
	let sumAp = 0;
	let rocketCount = 0;

	// 4つ毎に取得 → 偵察機補正チェック
	for (let i = 0; i < count; i++) {
		// 本ユニット
		let unit = new LandBase(0, 0);
		// 偵察機搭載時用仮ユニット
		const unit_sub = new LandBase(0, 0);

		// 最大4つ取得
		for (let j = 0; j < 4; j++) {
			const plane = planes[j];
			const planeObj = getLandBasePlaneObject(plane);
			unit.planes.push(planeObj);
			unit.defenseAirPower += planeObj.defenseAirPower;
			unit_sub.planes.push(planeObj);
			unit_sub.defenseAirPower += planeObj.defenseAirPower;

			sumAp += planeObj.defenseAirPower;

			// 重爆空襲時補正
			if (isHeavyDef) {
				if (ROCKETS.includes(plane.id)) rocketCount++;
				// 対重爆時補正 ロケット0機:0.5、1機:0.8、2機:1.1、3機異常:1.2
				const sumAp_ = Math.floor((rocketCount === 0 ? 0.5 : rocketCount === 1 ? 0.8 : rocketCount === 2 ? 1.1 : 1.2) * sumAp);
				if (sumAp_ >= destAp) break;
			}
			else if (sumAp >= destAp) break;
		}

		// 仮ユニットにて下位機体を偵察機に変更してみる (4スロ未満かつ制空が足りている場合は不要、ロケット戦闘機は3機確定で搭載されるので上書きされない)
		if (recons.length > i && !(unit_sub.planes.length < 3 && sumAp >= destAp)) {
			const plane = recons[i];
			const planeObj = getLandBasePlaneObject(plane);
			const changeSlotIndex = Math.min(unit_sub.planes.length, 3);
			let prevPlane = unit_sub.planes[changeSlotIndex];
			if (!prevPlane) prevPlane = new LandBasePlane(0);
			const prevAp = prevPlane.defenseAirPower;

			unit_sub.planes[changeSlotIndex] = planeObj;
			unit_sub.defenseAirPower += planeObj.defenseAirPower - prevAp;

			unit_sub.updateDefenseAirPower();
		}

		// 制空が上昇する場合、または依然として目標制空値を満たす場合は仮ユニットの方を採用
		if (unit_sub.defenseAirPower >= unit.defenseAirPower || unit_sub.defenseAirPower >= destAp) {
			const prevAp = unit.defenseAirPower;
			unit = unit_sub;
			// 全航空隊総制空値更新
			sumAp += unit_sub.defenseAirPower - prevAp;
		}

		// 本ユニットセット
		const planeCount = unit.planes.length;
		if (planeCount !== 4) {
			for (let index = 0; index < 4 - planeCount; index++) {
				unit.planes.push(new LandBasePlane(0));
			}
		}
		equipList[i] = unit;

		// 使用した装備削除
		for (const plane of unit.planes) {
			let isFirst = true;
			planes = planes.filter((v) => {
				if (isFirst && v.id === plane.id) {
					isFirst = false;
					return false;
				}
				return true;
			});
		}

		if (isHeavyDef) {
			// 対重爆時補正 ロケット0機:0.5、1機:0.8、2機:1.1、3機異常:1.2
			const sumAp_ = Math.floor((rocketCount === 0 ? 0.5 : rocketCount === 1 ? 0.8 : rocketCount === 2 ? 1.1 : 1.2) * sumAp);
			if (sumAp_ >= destAp) break;
		}
		else if (sumAp >= destAp) break;
	}

	return equipList;
}

/*==================================
		イベント処理
==================================*/

/**
 * 各種モーダル終了時イベント
 * @param {JQuery} $this
 */
function modal_Closed($this) {
	// いらないオブジェクト参照をやめさせる
	switch ($this.attr('id')) {
		case "modal_share":
		case "modal_ship_select":
		case "modal_plane_select":
		case "modal_enemy_select":
		case "modal_enemy_pattern":
		case "modal_collectively_setting":
		case "modal_lb_target":
		case "modal_level_input":
			$target = null;
			calculate();
			break;
		case "modal_plane_preset":
			$target = null;
			planePreset = null;
			calculate();
			break;
		case "modal_fleet_antiair_input":
			calculate();
			inform_success('対空砲火設定を更新しました。');
			break;
		case "modal_result_detail":
			setTimeout(() => {
				chartInstance.destroy();
				chartInstance = null;
			}, 80);
			break;
		case "modal_contact_detail":
			setTimeout(() => {
				chartInstance.destroy();
				chartInstance = null;
				if (subChartInstance) {
					subChartInstance.destroy();
					subChartInstance = null;
				}
			}, 80);
			break;
		case "modal_main_preset":
			// ボタンモードを戻す
			$('#modal_main_preset').find('.btn_commit_preset').text('編成保存');
			$('#modal_main_preset').find('.btn_commit_preset').removeClass('rename');
			// アップロード非チェック
			$('#allow_upload_preset').prop('checked', false);
			$('#btn_upload_preset').addClass('d-none');
			break;
		case "modal_confirm":
			if (confirmType === 'Error') {
				try {
					window.location.reload(true);
				} catch (error) {
					window.location.href = '../list/';
				}
			}
			confirmType = null;
			break;
		default:
			break;
	}
}

/**
 * 大コンテンツ入れ替えモード起動ボタンクリック時
 * @param {JQuery} $this
 */
function btn_content_trade_Clicked($this) {
	$('body,html').animate({ scrollTop: 0 }, 200, 'swing');
	$('.btn_commit_trade').addClass('d-flex').removeClass('d-none');
	$('.r_btn:not(.btn_commit_trade)').addClass('d-none').removeClass('d-lg-flex');
	// 開始時にいったん全部最小化、handle追加
	$('#main').find('.collapse_content').each(function () {
		$(this).parent().addClass('trade_enabled');
		if ($(this).attr('class').includes('show')) {
			$(this).addClass('tmpHide').collapse('hide');
		}
	});
	$this.blur();
}

/**
 * 大コンテンツ入れ替え処理終了時
 */
function main_contents_Sortable_End() {
	setting.contentsOrder = [];
	$('#main > div:not(#main_footer)').each((i, e) => {
		const contentId = $(e).attr('id');
		setting.contentsOrder.push(contentId);
	});

	saveSetting();
}

/**
 * 大コンテンツ入れ替え完了クリック時
 */
function commit_content_order() {
	// 動作中はキャンセル
	if ($('#landBase_content').hasClass('collapsing')) return false;

	// 一時閉じていたやつは終了時に展開 -> 機体ドラッグ時位置ずれバグあり　要検証
	$('.tmpHide').collapse('show');
	// handle解除
	$('.trade_enabled').removeClass('trade_enabled');
	$('.btn_commit_trade').addClass('d-none').removeClass('d-flex');
	$('.r_btn:not(.btn_commit_trade)').removeClass('d-none');
	$('.btn_show_plane_box').addClass('d-lg-flex d-none');
}

/**
 * 一括設定クリック時
 * @param {JQuery} $this
 */
function btn_ex_setting_Clicked($this) {
	const parentId = $this.closest('.contents').attr('id');
	const $modal = $('#modal_collectively_setting');

	$modal.find('.btn').removeClass('d-none');
	$modal.data('target', parentId);
	switch (parentId) {
		case 'landBase':
			$modal.find('.modal-title').text('一括設定　-基地航空隊-');
			$modal.find('.btn_remove_ship_all').addClass('d-none');
			$modal.find('.btn_remove_enemy_all').addClass('d-none');
			$modal.find('.btn_slot_default').addClass('d-none');
			$modal.find('.coll_slot_range').attr('max', 18).data('target', parentId);
			break;
		case 'friendFleet':
			$modal.find('.modal-title').text('一括設定　-艦娘-');
			$modal.find('.btn_remove_enemy_all').addClass('d-none');
			$modal.find('.coll_slot_range').attr('max', 99).data('target', parentId);
			break;
		default:
			break;
	}

	$modal.modal('show');
}

/**
 * 艦載機ボックス展開クリック時
 * @param {JQuery} $this
 */
function btn_show_plane_box_Clicked($this) {
	// 基地なら陸攻ページを開く
	if ($this.closest('.contents').attr('id') === 'landBase') {
		if (castInt($('#draggable_plane_type_select').val()) < 101) {
			$('#draggable_plane_type_select').val(101);
		}
	}
	else if (castInt($('#draggable_plane_type_select').val()) >= 101) {
		$('#draggable_plane_type_select').val(1);
	}

	createDraggablePlaneTable();
	// 押されたボタン付近に出現
	const box = document.getElementById('draggable_plane_box');
	box.classList.remove('d-none');
	box.style.position = 'fixed';
	box.style.top = `${$this[0].getBoundingClientRect().top}px`;
	box.style.left = `${$this[0].getBoundingClientRect().left - 220}px`;
}

/**
 * 基地空襲を起こす
 */
function btn_air_raid_Clicked() {

	// 誤操作があまりにもひどいので補給挟んでおく
	$('.lb_tab').each((i, e) => {
		$(e).find('.lb_plane').each((i, e2) => {
			if (castInt($(e2)[0].dataset.planeid) > 0) {
				$(e2).find('.slot').text(18);
			}
		});
	});

	// 搭載数のバリデーション
	const l = createLandBaseInstance(false);

	$('.lb_tab').each((i, e) => {
		let isOk = false;
		let downCount = 4;
		$(e).find('.lb_plane').each((i, e2) => {
			if (!isOk && castInt($(e2)[0].dataset.planeid) > 0) {
				// 基地空襲を発生させる
				const currentSlot = castInt($(e2).find('.slot').text());

				// このスロットだけで受けきれる
				if (currentSlot > downCount) {
					$(e2).find('.slot').text(currentSlot - downCount);
					isOk = true;
				}
				else {
					// このスロットでは受けきれない場合、次のスロットに持ち越し
					$(e2).find('.slot').text(1);
					downCount -= (currentSlot - 1);
				}
			}

		});
	});

	calculate();
}

/**
 * 基地補給
 */
function btn_supply_Clicked() {
	$('.lb_tab').each((i, e) => {
		$(e).find('.lb_plane').each((i, e2) => {
			if (castInt($(e2)[0].dataset.planeid) > 0) {
				$(e2).find('.slot').text(18);
			}
		});
	});

	calculate();
}


/**
 * コンテンツキャプチャクリック
 * @param {JQuery} $this
 */
function btn_capture_Clicked($this) {
	const $targetContent = $this.closest('.contents');
	$targetContent.addClass('capturing');

	if (document.body.classList.contains('dark-theme')) {
		$targetContent.addClass('capture_dark');
		if (document.body.classList.contains('deep_blue_theme')) {
			$targetContent.addClass('capture_deep_blue');
		}
	}
	else $targetContent.addClass('capture_nomal');

	// 基地横並びに
	$targetContent.find('.lb_tab').removeClass('tab-pane fade');

	// レンダリングできなさそうなやつを置換 or 非表示
	const $no_captures = $targetContent.find('.no_capture:not(.d-none)');
	$no_captures.addClass('d-none');
	$targetContent.find('.btn_remove_plane').addClass('btn_remove_plane_capture');
	$targetContent.find('.r_btn').addClass('d-none');
	$targetContent.find('.d-lg-flex').addClass('d-none_lg').removeClass('d-lg-flex');
	$targetContent.find('.custom-checkbox').addClass('d-none');
	$targetContent.find('.battle_only').removeClass('ml-auto').addClass('ml-2');
	$targetContent.find('.plane_name_span').each((i, e) => {
		if ($(e).text() === '機体を選択') $(e).text('-');
	});

	// レンダリングズレ修正
	$targetContent.find('.custom-select').addClass('pt-0');
	$targetContent.find('.custom-select option').addClass('d-none');
	$targetContent.find('.form-control').addClass('pt-0');
	$targetContent.find('.general_box').addClass('general_box_capture');

	const prevY = window.pageYOffset;

	html2canvas($targetContent[0], {
		onrendered: function (canvas) {
			const imgData = canvas.toDataURL();

			// クリップボードコピー
			if ($('#clipboard_mode').prop('checked') && typeof ClipboardItem === "function") {
				try {
					canvas.toBlob(blob => {
						navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
					});
				} catch (error) {
					downloadImage(imgData);
				}
			}
			else {
				downloadImage(imgData);
			}

			// 戻す
			$targetContent.removeClass('capture_nomal capture_dark capture_deep_blue');
			$targetContent.find('.custom-checkbox').removeClass('d-none');
			$targetContent.find('.r_btn:not(.btn_commit_trade)').removeClass('d-none');
			$targetContent.find('.d-none_lg').addClass('d-none d-lg-flex').removeClass('d-none_lg');
			$targetContent.find('.btn_remove_plane').removeClass('btn_remove_plane_capture');
			$targetContent.find('.battle_only').addClass('ml-auto').removeClass('ml-2');
			$targetContent.find('.plane_name_span').each((i, e) => {
				if ($(e).text() === '-') $(e).text('機体を選択');
			});
			$no_captures.removeClass('d-none');

			$targetContent.find('.custom-select').removeClass('pt-0');
			$targetContent.find('.custom-select option').removeClass('d-none');
			$targetContent.find('.form-control').removeClass('pt-0');
			$targetContent.find('.general_box').removeClass('general_box_capture');

			$targetContent.removeClass('capturing');
			if ($('#lb_tab_select').css('display') !== 'none' && !$('#lb_item1').attr('class').includes('tab-pane')) {
				$('.lb_tab').addClass('tab-pane fade');
				$('.lb_tab:first').tab('show');
			}
			window.scrollTo(0, prevY);
		}
	});
}

/**
 * 保存処理
 * @param {*} data
 */
function downloadImage(data) {
	const fname = 'screenshot_' + formatDate(new Date(), 'yyyyMMdd_HHmmss') + '.jpg';

	if (window.navigator.msSaveBlob) {
		const encodeData = atob(data.replace(/^.*,/, ''));
		const outData = new Uint8Array(encodeData.length);
		for (let i = 0; i < encodeData.length; i++) {
			outData[i] = encodeData.charCodeAt(i);
		}
		const blob = new Blob([outData], ["image/png"]);
		window.navigator.msSaveOrOpenBlob(blob, fname);
	} else {
		const a = document.getElementById("getImage");
		a.href = data;
		a.download = fname;
		a.click();
	}
}

/**
 * コンテンツ一括解除クリック
 * @param {JQuery} $this
 */
function btn_reset_content_Clicked($this) {
	const parentId = $this.closest('.contents').attr('id');
	switch (parentId) {
		case 'landBase':
			$('.lb_plane').each((i, e) => setLBPlaneDiv($(e)));
			break;
		case 'friendFleet':
			clearShipDivAll();
			resetFleetAntiairInput();
			break;
		case 'enemyFleet':
			clearEnemyDivAll();
			break;
		default:
			break;
	}
	calculate();
}

/**
 * 全艦載機解除クリック
 * @param {JQuery} $this
 */
function btn_remove_plane_all_Clicked($this) {
	const $targetContent = $('#' + $('#modal_collectively_setting').data('target'));
	clearPlaneDivAll($targetContent);
}

/**
 * 全艦娘解除クリック
 */
function btn_remove_ship_all_Clicked() {
	clearShipDivAll();
	$('#modal_collectively_setting').modal('hide');
}

/**
 * 搭載数最大クリック
 * @param {JQuery} $this
 */
function btn_slot_max_Clicked($this) {
	const $targetContent = $('#' + $('#modal_collectively_setting').data('target'));
	if ($targetContent.attr('id') === 'landBase') {
		$('.coll_slot_range').val(18);
	}
	else if ($targetContent.attr('id') === 'friendFleet') {
		$('.coll_slot_range').val(99);
	}

	coll_slot_range_Changed($('.coll_slot_range'));
}

/**
 * 搭載数初期値クリック
 * @param {JQuery} $this
 */
function btn_slot_default_Clicked($this) {
	const $targetContent = $('#' + $('#modal_collectively_setting').data('target'));
	if ($targetContent.attr('id') === 'friendFleet') {
		$targetContent.find('.ship_plane').each((i, e) => {
			$(e).find('.slot').text($(e).find('.slot_select_parent').data('ini'));
		});
	}
}

/**
 * 搭載数最小クリック
 */
function btn_slot_min_Clicked() {
	$('.coll_slot_range').val(0);
	coll_slot_range_Changed($('.coll_slot_range'));
}

/**
 * 一括変更搭載数レンジ変更
 * @param {JQuery} $this
 */
function coll_slot_range_Changed($this) {
	const $targetContent = $('#' + $('#modal_collectively_setting').data('target'));
	let value = castInt($this.val());
	value = value > castInt($this.attr('max')) ? castInt($this.attr('max')) : value;
	if ($targetContent.attr('id') === 'landBase') {
		$targetContent.find('.lb_plane').each((i, e) => $(e).find('.slot').text(value));
	}
	else if ($targetContent.attr('id') === 'friendFleet') {
		$targetContent.find('.ship_plane').each((i, e) => $(e).find('.slot').text(value));
	}

	$('.coll_slot_input').val(value);
}

/**
 * 一括変更搭載数直接変更
 * @param {JQuery} $this
 */
function coll_slot_input_Changed($this) {
	// 入力検証 -> 数値 かつ 0 以上 max 以下　違ってたら修正
	let value = validateInputNumber($this.val(), castInt($('.coll_slot_range').attr('max')));

	$this.val(value);
	$('.coll_slot_range').val(value);
	coll_slot_range_Changed($('.coll_slot_range'));
}

/**
 * 一括改修値変更クリック
 * @param {JQuery} $this
 */
function btn_remodel_Clicked($this) {
	const $targetContent = $('#' + $('#modal_collectively_setting').data('target'));
	const remodel = castInt($this[0].dataset.remodel);
	if ($targetContent.attr('id') === 'landBase') {
		$targetContent.find('.lb_plane').each((i, e) => $(e).find('.remodel_select:not(.remodel_disabled)').find('.remodel_value').text(remodel));
	}
	else if ($targetContent.attr('id') === 'friendFleet') {
		$targetContent.find('.ship_plane').each((i, e) => $(e).find('.remodel_select:not(.remodel_disabled)').find('.remodel_value').text(remodel));
	}
}

/**
 * 戦闘機のみ熟練度最大クリック
 */
function btn_fighter_prof_max_Clicked() {
	const $targetContent = $('#' + $('#modal_collectively_setting').data('target'));
	if ($targetContent.attr('id') === 'landBase') {
		$targetContent.find('.lb_plane').each((i, e) => {
			if (FIGHTERS.includes(castInt($(e)[0].dataset.type))) {
				setProficiency($(e).find('.prof_select'), 7);
			}
		});
	}
	else if ($targetContent.attr('id') === 'friendFleet') {
		$targetContent.find('.ship_plane').each((i, e) => {
			if (FIGHTERS.includes(castInt($(e)[0].dataset.type))) {
				setProficiency($(e).find('.prof_select'), 7);
			}
		});
	}
}

/**
 * 熟練度ボタンクリック
 * @param {JQuery} $this
 */
function btn_prof_Clicked($this) {
	const $targetContent = $('#' + $('#modal_collectively_setting').data('target'));
	const prof = $this[0].dataset.prof;
	if ($targetContent.attr('id') === 'landBase') {
		$targetContent.find('.lb_plane').each((i, e) => {
			// 陸偵は||まで
			if (prof > 2 && castInt($(e)[0].dataset.planeid) === 312) setProficiency($(e).find('.prof_select'), 2);
			else if (castInt($(e)[0].dataset.planeid) !== 311) setProficiency($(e).find('.prof_select'), prof);
		});
	}
	else if ($targetContent.attr('id') === 'friendFleet') {
		$targetContent.find('.ship_plane').each((i, e) => {
			setProficiency($(e).find('.prof_select'), prof);
		});
	}
}

function plane_lock_Clicked($this) {
	$this.addClass('d-none');
	$this.closest('.ship_plane').find('.plane_unlock').removeClass('d-none');
}

function plane_unlock_Clicked($this) {
	$this.addClass('d-none');
	$this.closest('.ship_plane').find('.plane_lock').removeClass('d-none');
}

/**
 * 改修値メニュー展開時 初回展開時メニュー生成
 * @param {JQuery} $this
 */
function remodelSelect_Shown($this) {
	if (!$this.find('.dropdown-menu').html().trim()) {
		let menuText = '';
		for (let i = 0; i < 10; i++) {
			menuText += `<div class="remodel_item" data-remodel="${i}"><i class="fas fa-star"></i>+${i}</div>`;
		}
		menuText += '<div class="remodel_item" data-remodel="10"><i class="fas fa-star"></i>max</div>';
		$this.find('.dropdown-menu').append(menuText);
	}
	else $this.find('.remodel_item_selected').removeClass('remodel_item_selected');
}

/**
 * 改修値変更時
 * @param {JQuery} $this
 */
function remodelSelect_Changed($this) {
	if ($this.find('.remodel_item_selected').length) {
		const remodel = Math.min(castInt($this.find('.remodel_item_selected').data('remodel')), 10);
		$this.removeClass('remodel_item_selected');
		$this.find('.remodel_value').text(remodel);
		calculate();
	}
}

/**
 * 熟練度メニュー展開時 初回展開時メニュー生成
 * @param {JQuery} $this
 */
function profSelect_Shown($this) {
	if (!$this.find('.dropdown-menu').html().trim()) {
		let menuText = '';
		for (let i = 7; i >= 0; i--) {
			menuText += `<a class="dropdown-item prof_item"><img class="prof_opt" alt="${getProfString(i)}" data-prof="${i}" src="../img/util/prof${i}.png"></a>`;
		}
		$this.find('.dropdown-menu').append(menuText);
	}
}

/**
 * 熟練度変更時
 * @param {JQuery} $this .prof_item
 * @param {boolean} cancelCalculate 計算を起こさせない場合true 未指定時 false
 */
function proficiency_Changed($this, cancelCalculate = false) {
	const $orig = $this.find('.prof_opt');
	const $targetSelect = $this.parent().prev();
	const prof = $orig[0].dataset.prof;
	$targetSelect.attr('src', $orig.attr('src')).attr('alt', $orig.attr('alt'));
	$targetSelect[0].dataset.prof = prof;

	if (!cancelCalculate) calculate();
}

/**
 * 熟練度変更
 * @param {JQuery} $targetSelect 適用先.prof_select
 * @param {number} prof 適用する値
 */
function setProficiency($targetSelect, prof) {
	$targetSelect.attr('src', `../img/util/prof${prof}.png`).attr('alt', getProfString(prof));
	$targetSelect[0].dataset.prof = prof;
}

/**
 * 初期熟練度変更時
 * @param {JQuery} $this
 */
function init_proficiency_Changed($this) {
	proficiency_Changed($this, true);

	// localStorage更新
	const prof = castInt($this.find('.prof_opt')[0].dataset.prof);
	const tmp = setting.defaultProf.find(v => v.id === castInt($this.closest('.init_prof')[0].dataset.typeid));
	if (!tmp) {
		// ないカテゴリなら追加
		setting.defaultProf.push({ id: castInt($this.closest('.init_prof')[0].dataset.typeid), prof: prof });
	}
	else {
		tmp.prof = prof;
	}
	saveSetting();
}

/**
 * 搭載数調整欄展開時
 * @param {JQuery} $this
 */
function slot_select_parent_Show($this) {

	// 初回起動時メニュー生成
	if (!$this.find('.dropdown-menu').html().trim()) {
		$this.find('.dropdown-menu').append(`
		<span class="dropdown-header py-1 px-1 font_size_12">搭載数を入力</span>
			<div class="d-flex mb-2 justify-content-between">
				<div class="align-self-center flex-grow-1">
					<input type="number" class="form-control form-control-sm slot_input" value="0" min="0" max="99">
				</div>
				<div class="ml-1 align-self-center">
					<button type="button" data-ini="0" class="btn btn-sm btn-primary slot_ini">
						<span class="text-nowrap">初期値</span>
					</button>
				</div>
			</div>
			<input type="range" class="custom-range slot_range" value="0" min="0" max="99">
		`);
	}

	const preSlot = castInt($this.find('.slot').text());
	$this.find('.slot_input').val(preSlot);
	$this.find('.slot_range').val(preSlot);
}

/**
 * 搭載数調整欄 レンジバー変更時
 * @param {JQuery} $this
 */
function slot_range_Changed($this) {
	const $slotArea = $this.closest('.slot_select_parent');
	$slotArea.find('.slot').text($this.val());
	$slotArea.find('.slot_input').val($this.val());
}

/**
 * 搭載数調整欄 搭載数入力欄変更時
 * @param {JQuery} $this
 */
function slot_input_Changed($this) {
	// 入力検証 -> 数値 かつ 0 以上 max 以下　違ってたら修正
	const value = validateInputNumber($this.val(), castInt($this.attr('max')));

	$this.val(value);
	$this.closest('.slot_select_parent').find('.slot').text(value);
	$this.next().val(value);
}

/**
 * 搭載数調整欄 初期ボタンクリック
 * @param {JQuery} $this
 */
function slot_ini_Clicked($this) {
	const $slotArea = $this.closest('.slot_select_parent');
	const defaultValue = $slotArea.data('ini');
	$slotArea.find('.slot').text(defaultValue);
	$slotArea.find('.slot_input').val(defaultValue);
	$slotArea.find('.slot_range').val(defaultValue);
}

/**
 * 搭載数調整欄終了時
 * @param {JQuery} $this
 */
function slot_select_parent_Close($this) {
	let inputSlot = castInt($this.find('.slot_input').val());
	let maxSlot = castInt($this.find('.slot_input').attr('max'));
	$this.find('.slot').text(inputSlot > maxSlot ? maxSlot : inputSlot);
	calculate();
}

/**
 * 練度選択
 * @param {JQuery} $this
 */
function ship_level_input_Changed($this) {
	// 入力検証 -> 数値 かつ 0 以上 max 以下　違ってたら修正
	const value = validateInputNumber($this.val(), castInt($this.attr('max')));
	$this.val(value);
	$target.text(value ? value : 1);
	$this.next().val(value);
}

/**
 * 練度選択 レンジバー変更時
 * @param {JQuery} $this
 */
function ship_level_range_Changed($this) {
	const $area = $('#modal_level_input');
	const level = castInt($this.val());
	$area.find('.ship_level_input').val(level);
	$target.text(level);
}

/**
 * 練度選択 レンジバー変更時
 * @param {JQuery} $this
 */
function level_Clicked($this) {
	const level = castInt($this[0].dataset.level);
	const $area = $('#modal_level_input');
	$area.find('.ship_level_input').val(level);
	$area.find('.ship_level_range').val(level);
	$target.text(level);
}

/**
 * 乗せられた位置に機体ツールチップ展開
 * @param {JQuery} $this
 * @param {boolean} isLandBase 基地かどうか 基本はfalse
 */
function showPlaneToolTip($this, isLandBase = false) {
	const $parent = $this.closest(isLandBase ? '.lb_plane' : '.ship_plane');
	if (!$parent.length || !$parent[0].dataset.planeid || $parent.hasClass('ui-draggable-dragging')) return;

	// 機体情報オブジェクト取得
	const id = castInt($parent[0].dataset.planeid);
	const slot = castInt($parent[0].getElementsByClassName('slot')[0].textContent);
	const remodel = castInt($parent[0].getElementsByClassName('remodel_value')[0].textContent);
	const level = castInt($parent[0].getElementsByClassName('prof_select')[0].dataset.prof);

	/** @type {Plane} */
	let plane = null;
	if ($parent[0].classList.contains('lb_plane')) {
		plane = new LandBasePlane(id, slot, remodel, level);
	}
	else {
		plane = new ShipPlane(id, slot, remodel, level);
	}

	let rawPlane = PLANE_DATA.find(v => v.id === plane.id);
	if (!rawPlane) return;

	let selectRate = [];
	if (plane.selectRate.length) {
		selectRate = plane.selectRate.map(v => (100 * v).toFixed(0) + '%');
	}

	let avoid = null;
	if (plane.avoid > 0) {
		avoid = AVOID_TYPE.find(v => v.id === plane.avoid);
	}

	const bonusTorpedo = Plane.getBonusTorpedo(plane.type, plane.remodel);
	const bonusBomber = Plane.getBonusBomber(plane.type, plane.remodel, rawPlane.antiAir);

	const text =
		`<div class="text-left">
			<div>
				<img src="../img/type/type${plane.type}.png" alt="${plane.type}" class="img-size-25">
				<span>${plane.name}</span>
				${plane.remodel ? `<span class="text_remodel">★${plane.remodel}</span>` : ''}
			</div>
			<div class="my-1">制空値: ${plane.airPower}</div>
			<div class="font_size_12 d-flex flex-wrap plane_status_box">
				${rawPlane.antiAir ? `<div class="col_half">
					<span>対空: ${rawPlane.antiAir}</span>
					${plane.bonusAntiAir ? `<span class="text_remodel">(+${plane.bonusAntiAir.toFixed(2)})</span>` : ''}
				</div>` : ''}
				${rawPlane.fire ? `<div class="col_half">火力: ${rawPlane.fire}</div>` : ''}
				${rawPlane.torpedo ? `<div class="col_half">
					<span>雷装: ${rawPlane.torpedo}</span>
					${bonusTorpedo ? `<span class="text_remodel">(+${bonusTorpedo.toFixed(2)})</span>` : ''}
				</div>` : ''}
				${rawPlane.bomber ? `<div class="col_half">
					<span>爆装: ${rawPlane.bomber}</span>
					${bonusBomber ? `<span class="text_remodel">(+${bonusBomber.toFixed(2)})</span>` : ''}
				</div>` : ''}
				${rawPlane.asw ? `<div class="col_half">対潜: ${rawPlane.asw}</div>` : ''}
				${rawPlane.armor ? `<div class="col_half">装甲: ${rawPlane.armor}</div>` : ''}
				${plane.scout ? `<div class="col_half">索敵: ${plane.scout}</div>` : ''}
				${plane.accuracy ? `<div class="col_half">命中: ${plane.accuracy}</div>` : ''}
				${rawPlane.avoid2 ? `<div class="col_half">回避: ${rawPlane.avoid2}</div>` : ''}
				${plane.antiBomber ? `<div class="col_half">対爆: ${plane.antiBomber}</div>` : ''}
				${plane.interception ? `<div class="col_half">迎撃: ${plane.interception}</div>` : ''}
				${plane.radius ? `<div class="col_half">半径: ${plane.radius}</div>` : ''}
				${LONGRANGES.includes(plane.id) ? `<div class="col_half">射程: 長</div>` : ''}
				${TAICHI.includes(plane.id) ? `<div class="col_half">対地: 可</div>` : ''}
			</div>
			${avoid ? `<div class="font_size_12">射撃回避: ${avoid.name} (加重: ${avoid.adj[0]} 艦防: ${avoid.adj[1].toFixed(1)})</div>` : ''}
			${rawPlane.type === 9 ? `<div class="font_size_12">鋼材消費 (噴式強襲発生時): ${Math.round(plane.slot * plane.cost * 0.2)}` : ''}
			${selectRate.length ? `<div class="font_size_12">触接選択率(確保時): ${selectRate[0]}</div>` : ''}
		</div>`;

	showTooltip($this[0], text, 'right');
}

/**
 * 機体一覧用ツールチップ展開
 * @param {JQuery} $this
 */
function showPlaneBasicToolTip($this) {
	// 機体情報オブジェクト取得
	const plane = PLANE_DATA.find(v => v.id === castInt($this[0].dataset.planeid));
	if (!plane) return;

	// 改修値
	let remodel = 0;

	let bonusAA = 0;
	if ($this.find('.plane_td_remodel').length) {
		remodel = castInt($this.find('.plane_td_remodel')[0].dataset.remodel);

		const tmp = Object.assign({ remodel: remodel }, plane);
		bonusAA = Plane.getBonusAntiAir(tmp.id, tmp.type, tmp.remodel, tmp.antiAir);
	}
	const actualAA = plane.antiAir + bonusAA;
	const nmAA = actualAA + 1.5 * plane.interception;
	const defAA = actualAA + plane.interception + 2.0 * plane.antiBomber;
	const avoid = plane.avoid ? AVOID_TYPE.find(v => v.id === plane.avoid) : null

	const bonusTorpedo = Plane.getBonusTorpedo(plane.type, remodel);
	const bonusBomber = Plane.getBonusBomber(plane.type, remodel, plane.antiAir);

	const text =
		`<div class="text-left">
			<div>
				<img src="../img/type/type${plane.type}.png" alt="${plane.type}" class="img-size-25">
				<span>${plane.name}</span>
				${remodel ? `<span class="text_remodel">★${remodel}</span>` : ''}
			</div>
			<div class="font_size_12 d-flex flex-wrap plane_status_box">
				${nmAA != actualAA ? `<div class="col_half"><span>出撃対空: ${nmAA}</span></div>` : ''}
				${defAA != actualAA ? `<div class="col_half"><span>防空対空: ${defAA}</span></div>` : ''}
				${plane.antiAir ? `<div class="col_half">
					<span>対空: ${plane.antiAir}</span>
					${bonusAA ? `<span class="text_remodel">(+${bonusAA.toFixed(2)})</span>` : ''}
				</div>` : ''}
				${plane.fire ? `<div class="col_half">火力: ${plane.fire}</div>` : ''}
				${plane.torpedo ? `<div class="col_half">
					<span>雷装: ${plane.torpedo}</span>
					${bonusTorpedo ? `<span class="text_remodel">(+${bonusTorpedo.toFixed(2)})</span>` : ''}
				</div>` : ''}
				${plane.bomber ? `<div class="col_half">
					<span>爆装: ${plane.bomber}</span>
					${bonusBomber ? `<span class="text_remodel">(+${bonusBomber.toFixed(2)})</span>` : ''}
				</div>` : ''}
				${plane.asw ? `<div class="col_half">対潜: ${plane.asw}</div>` : ''}
				${plane.armor ? `<div class="col_half">装甲: ${plane.armor}</div>` : ''}
				${plane.scout ? `<div class="col_half">索敵: ${plane.scout}</div>` : ''}
				${plane.accuracy ? `<div class="col_half">命中: ${plane.accuracy}</div>` : ''}
				${plane.avoid2 ? `<div class="col_half">回避: ${plane.avoid2}</div>` : ''}
				${plane.antiBomber ? `<div class="col_half">対爆: ${plane.antiBomber}</div>` : ''}
				${plane.interception ? `<div class="col_half">迎撃: ${plane.interception}</div>` : ''}
				${plane.radius ? `<div class="col_half">半径: ${plane.radius}</div>` : ''}
				${LONGRANGES.includes(plane.id) ? `<div class="col_half">射程: 長</div>` : ''}
				${TAICHI.includes(plane.id) ? `<div class="col_half">対地: 可</div>` : ''}
			</div>
			${avoid ? `<div class="font_size_12">射撃回避: ${avoid.name} ( 加重: ${avoid.adj[0]} 艦防: ${avoid.adj[1].toFixed(1)} )</div>` : ''}
			</div>`;

	showTooltip($this[0], text, 'bottom', 'window');
}

/**
 * 乗せられた位置に機体ツールチップ展開
 * @param {JQuery} $this
 */
function showEnemyPlaneToolTip($this) {
	if (!$this.length || !$this[0].dataset.planeid) return;

	// 機体情報オブジェクト取得
	const plane = ENEMY_PLANE_DATA.find(v => v.id === castInt($this[0].dataset.planeid));

	if (!plane) return;
	const text =
		`<div class="text-left">
			<div>
				<img src="../img/type/type${plane.type}.png" alt="${plane.type}" class="img-size-25">
				<span>${plane.name}</span>
			</div>
			<div class="font_size_12 d-flex flex-wrap plane_status_box">
				${plane.antiAir ? `<div class="col_half">対空: ${plane.antiAir}</div>` : ''}
				${plane.fire ? `<div class="col_half">火力: ${plane.fire}</div>` : ''}
				${plane.torpedo ? `<div class="col_half">雷装: ${plane.torpedo}</div>` : ''}
				${plane.bomber ? `<div class="col_half">爆装: ${plane.bomber}</div>` : ''}
				${plane.asw ? `<div class="col_half">対潜: ${plane.asw}</div>` : ''}
				${plane.armor ? `<div class="col_half">装甲: ${plane.armor}</div>` : ''}
				${plane.scout ? `<div class="col_half">索敵: ${plane.scout}</div>` : ''}
				${plane.accuracy ? `<div class="col_half">命中: ${plane.accuracy}</div>` : ''}
				${plane.avoid2 ? `<div class="col_half">回避: ${plane.avoid2}</div>` : ''}
			</div>
		</div>`;
	showTooltip($this[0], text);
}

/**
 * 指定ノードにツールチップを適用し、表示
 * @param {HTMLElement} node 指定DOM
 * @param {string} text 表示内容
 * @param {string} place 表示方向 top | right | left | buttom
 * @param {string} boundary 回り込み window | viewport
 */
function showTooltip(node, text, place = '', boundary = '') {
	$(node).tooltip('dispose');
	node.title = text;
	node.dataset.toggle = 'tooltip';
	node.dataset.html = true;
	node.dataset.trigger = 'manual';
	if (place) node.dataset.placement = place;
	if (boundary) node.dataset.boundary = boundary;
	$(node).tooltip('show');
}

/**
 * ツールチップ破棄
 * @param {HTMLElement} node 指定DOM
 */
function hideTooltip(node) {
	$(node).tooltip('hide');
	node.removeAttribute('title');
	delete node.dataset.originalTitle;
	delete node.dataset.html;
	delete node.dataset.toggle;
	delete node.dataset.placement;
	delete node.dataset.boundary;
	delete node.dataset.trigger;
	$(node).tooltip('dispose');
}

/**
 * 触接詳細制空ラジオ変更
 */
function contact_detail_redraw() {
	const index = castInt($('#modal_contact_detail').data('dispIndex'));
	if (index > -1) btn_show_contact_rate_lb_Clicked(null, index);
	else btn_show_contact_rate_Clicked();
}

/**
 * 触接詳細ボタンクリック基地
 * @param {JQuery} $this
 */
function btn_show_contact_rate_lb_Clicked($this, no = 0) {
	const lbNo = !$this ? no : castInt($this[0].dataset.lb) - 1;
	const landBase = createLandBaseInstance(false);

	const contactTable = createContactTable(landBase.landBases[lbNo].planes);
	const $nomal = document.getElementById('nomal_contact_table');
	document.getElementsByClassName('detail_contact_chart_parent')[0].classList.add('w-75');
	document.getElementsByClassName('detail_contact_chart_parent')[1].classList.add('d-none');
	document.getElementById('grand_contact_table').classList.add('d-none');
	document.getElementById('land_base_contact_tips').classList.remove('d-none');

	for (let i = 0; i < 3; i++) {
		const $tr = $nomal.getElementsByClassName('contact_status_' + i)[0];
		$tr.getElementsByClassName('td_start_contact_rate')[0].textContent = contactTable[i][0].toFixed(1) + '%';
		$tr.getElementsByClassName('td_120_contact_rate')[0].textContent = contactTable[i][1].toFixed(1) + '%';
		$tr.getElementsByClassName('td_117_contact_rate')[0].textContent = contactTable[i][2].toFixed(1) + '%';
		$tr.getElementsByClassName('td_112_contact_rate')[0].textContent = contactTable[i][3].toFixed(1) + '%';
		$tr.getElementsByClassName('td_sum_contact_rate')[0].textContent = contactTable[i][4].toFixed(1) + '%';
	}

	// グラフ表示
	const index = $('#contact_detail_0').prop('checked') ? 0 : $('#contact_detail_1').prop('checked') ? 1 : 2;
	const nomarlData = [contactTable[index][1], contactTable[index][2], contactTable[index][3], 100 - contactTable[index][4]];
	const chartLabels = ["120%触接", "117%触接", "112%触接", "不発"];
	const chartColors = ["rgb(100, 180, 255, 0.7)", "rgba(80, 220, 120, 0.7)", "rgba(255, 160, 100, 0.7)", "rgba(128, 128, 128, 0.5)"];
	const ctx = document.getElementById("detail_contact_chart");
	const borderColor = mainColor === '#000000' ? '#fff' : '#333';
	const titleColor = `rgba(${hexToRGB(mainColor).join(',')}, 0.8)`;
	// グラフ中央のアレ
	document.getElementById('detail_contact_rate_sum').textContent = contactTable[index][4].toFixed(1);

	if (!chartInstance) {
		chartInstance = new Chart(ctx, {
			type: 'doughnut',
			data: {
				labels: chartLabels,
				datasets: [{ backgroundColor: chartColors, data: nomarlData, borderColor: borderColor }]
			},
			plugins: [ChartDataLabels],
			options: {
				legend: { display: false },
				title: { display: true, text: `第${lbNo + 1}基地航空隊 触接率`, fontColor: titleColor },
				tooltips: { callbacks: { label: function (i, d) { return `${d.labels[i.index]}: ${d.datasets[0].data[i.index].toFixed(1)} %`; } } },
				plugins: { datalabels: { color: mainColor, formatter: function (v, c) { return v > 0 ? v.toFixed(1) + '%' : ''; } } }
			}
		});
	}
	else {
		chartInstance.data.datasets[0].data = nomarlData;
		chartInstance.update();
	}

	$('#modal_contact_detail').data('dispIndex', lbNo);
	$('#modal_contact_detail').modal('show');
}

/**
 * 触接詳細ボタンクリック
 */
function btn_show_contact_rate_Clicked() {
	const fleet = createFleetInstance(false);

	let planes = [];
	let unionPlanes = [];
	for (const ship of fleet.ships) {
		for (const plane of ship.planes) {
			if (plane.id === 0) {
				continue;
			}

			unionPlanes.push(plane);
			if (!ship.isEscort) {
				planes.push(plane);
			}
		}
	}

	const nomalContact = createContactTable(planes);
	const grandContact = createContactTable(unionPlanes);

	const $nomal = document.getElementById('nomal_contact_table');
	const $grand = document.getElementById('grand_contact_table');
	document.getElementsByClassName('detail_contact_chart_parent')[0].classList.remove('w-75');
	document.getElementsByClassName('detail_contact_chart_parent')[1].classList.remove('d-none');
	document.getElementById('grand_contact_table').classList.remove('d-none');
	document.getElementById('land_base_contact_tips').classList.add('d-none');

	for (let i = 0; i < 3; i++) {
		const $tr = $nomal.getElementsByClassName('contact_status_' + i)[0];
		$tr.getElementsByClassName('td_start_contact_rate')[0].textContent = nomalContact[i][0].toFixed(1) + '%';
		$tr.getElementsByClassName('td_120_contact_rate')[0].textContent = nomalContact[i][1].toFixed(1) + '%';
		$tr.getElementsByClassName('td_117_contact_rate')[0].textContent = nomalContact[i][2].toFixed(1) + '%';
		$tr.getElementsByClassName('td_112_contact_rate')[0].textContent = nomalContact[i][3].toFixed(1) + '%';
		$tr.getElementsByClassName('td_sum_contact_rate')[0].textContent = nomalContact[i][4].toFixed(1) + '%';
	}

	for (let i = 0; i < 3; i++) {
		const $tr = $grand.getElementsByClassName('contact_status_' + i)[0];
		$tr.getElementsByClassName('td_start_contact_rate')[0].textContent = grandContact[i][0].toFixed(1) + '%';
		$tr.getElementsByClassName('td_120_contact_rate')[0].textContent = grandContact[i][1].toFixed(1) + '%';
		$tr.getElementsByClassName('td_117_contact_rate')[0].textContent = grandContact[i][2].toFixed(1) + '%';
		$tr.getElementsByClassName('td_112_contact_rate')[0].textContent = grandContact[i][3].toFixed(1) + '%';
		$tr.getElementsByClassName('td_sum_contact_rate')[0].textContent = grandContact[i][4].toFixed(1) + '%';
	}

	// グラフ表示
	const index = $('#contact_detail_0').prop('checked') ? 0 : $('#contact_detail_1').prop('checked') ? 1 : 2;
	const nomarlData = [nomalContact[index][1], nomalContact[index][2], nomalContact[index][3], 100 - nomalContact[index][4]];
	const grandData = [grandContact[index][1], grandContact[index][2], grandContact[index][3], 100 - grandContact[index][4]];
	const chartLabels = ["120%触接", "117%触接", "112%触接", "不発"];
	const chartColors = ["rgb(100, 180, 255, 0.7)", "rgba(80, 220, 120, 0.7)", "rgba(255, 160, 100, 0.7)", "rgba(128, 128, 128, 0.5)"];
	const ctx = document.getElementById("detail_contact_chart");
	const ctx2 = document.getElementById("detail_contact_chart_2");
	const borderColor = mainColor === '#000000' ? '#fff' : '#333';
	const titleColor = `rgba(${hexToRGB(mainColor).join(',')}, 0.8)`;
	// グラフ中央のアレ
	document.getElementById('detail_contact_rate_sum').textContent = nomalContact[index][4].toFixed(1);
	document.getElementById('detail_contact_rate_sum_2').textContent = grandContact[index][4].toFixed(1);

	if (!chartInstance) {
		chartInstance = new Chart(ctx, {
			type: 'doughnut',
			data: {
				labels: chartLabels,
				datasets: [{ backgroundColor: chartColors, data: nomarlData, borderColor: borderColor }]
			},
			plugins: [ChartDataLabels],
			options: {
				legend: { display: false },
				title: { display: true, text: '対敵通常艦隊', fontColor: titleColor },
				tooltips: { callbacks: { label: function (i, d) { return `${d.labels[i.index]}: ${d.datasets[0].data[i.index].toFixed(1)} %`; } } },
				plugins: { datalabels: { color: mainColor, formatter: function (v, c) { return v > 0 ? v.toFixed(1) + '%' : ''; } } }
			}
		});
	}
	else {
		chartInstance.data.datasets[0].data = nomarlData;
		chartInstance.update();
	}

	if (!subChartInstance) {
		subChartInstance = new Chart(ctx2, {
			type: 'doughnut',
			data: {
				labels: chartLabels,
				datasets: [{ backgroundColor: chartColors, data: grandData, borderColor: borderColor }]
			},
			plugins: [ChartDataLabels],
			options: {
				legend: { display: false },
				title: { display: true, text: '対敵連合艦隊', fontColor: titleColor },
				tooltips: { callbacks: { label: function (i, d) { return `${d.labels[i.index]}: ${d.datasets[0].data[i.index].toFixed(1)} %`; } } },
				plugins: { datalabels: { color: mainColor, formatter: function (v, c) { return v > 0 ? v.toFixed(1) + '%' : ''; } } }
			}
		});
	}
	else {
		subChartInstance.data.datasets[0].data = grandData;
		subChartInstance.update();
	}

	$('#modal_contact_detail').data('dispIndex', -1);
	$('#modal_contact_detail').modal('show');
}

/**
 * 対空砲火入力欄展開
 */
function btn_antiair_input_Clicked() {
	let text = '';
	for (let i = 0; i < 12; i++) {
		const prevValue = (i < inputAntiAirWeights.length ? inputAntiAirWeights[i] : 0);
		text += `
			<tr class="${(i + 1) > 6 ? 'd-none escort_fleet' : 'main_fleet'}">
				<td class="font_size_11 ${(i + 1) <= 6 ? 'text-primary' : 'text-success'}">${i + 1}</td>
				<td><input type="number" class="form-control form-control-sm antiair_weight" value="${prevValue}"></td>
				<td class="rate_shoot_down">-</td>
				<td class="fixed_shoot_down">-</td>
				<td class="minimum_shoot_down">-</td>
			</tr>`;
	}
	$('#antiair_input_table tbody').html(text);

	// 対空CI入力欄追加
	for (let i = 0; i < fleetStage2Table.length; i++) {
		const data = fleetStage2Table[i];
		if (data.rate > 0) {
			const $tr = $(`#antiair_cutin_inputs tr:eq(${i})`);
			$tr.find('.select_antiair_cutin_td').val(data.cutinId);
			$tr.find('.cutin_rate').val(data.rate);

			// 次の入力欄の作成
			if (data.cutinId > 0) {
				antiAirCutinChanged($tr.find('.cutin_rate'), false);
			}
		}
	}

	antiair_grand_Changed();
	updateFleetStage2Table();

	$('#modal_fleet_antiair_input').modal('show');
}

/**
 * 練度変更
 * @param {JQuery} $this
 */
function form_ship_level_Clicked($this) {
	$target = $this.find('.ship_level');

	const $modal = $('#modal_level_input');
	const level = castInt($target.text());
	$modal.find('.ship_level_input').val(level);
	$modal.find('.ship_level_range').val(level);
	$modal.modal('show');
}

/**
 * 自艦隊対空性能の計算 モーダル内
 */
function updateFleetStage2Table() {
	const formationId = castInt($('#fleet_antiair_formation').val());
	let fleetAntiAir = castFloat($('#fleet_antiair_base').val());
	const isGrand = $('#antiair_grand').prop('checked');
	const isAirRaid = isGrand && $('#antiair_air_raid').prop('checked');

	const maxFixedList = [];
	const minFixedList = [];
	let maxMinimum = 0;
	let minMinimum = 9999;

	// 艦隊防空値 * 陣形補正
	const formation = FORMATION.find(v => v.id === formationId)
	fleetAntiAir *= formation ? formation.correction : 1.0;
	$('#fleet_antiair').val(fleetAntiAir);

	fleetStage2Table = [];
	inputAntiAirWeights = [];
	$('#antiair_weight_inputs').find('tr:not(.d-none)').each((i, e) => {
		const input_weight = validateInputNumber($(e).find('.antiair_weight').val(), 999);
		if (input_weight !== $(e).find('.antiair_weight').val()) $(e).find('.antiair_weight').val(input_weight);

		// 連合補正
		let adj = 1.0;
		if (isGrand) {
			// 第1艦隊
			if (i < 6) adj = isAirRaid ? 0.78 : 0.8;
			// 第2艦隊
			else adj = 0.48
		}

		const weight = castInt(input_weight);
		const rate = weight * adj / 400;
		const fixed = Math.floor(((weight + fleetAntiAir) * adj) / 10);
		inputAntiAirWeights.push(weight);

		if (weight === 0) {
			$(e).find('.rate_shoot_down').text('-');
			$(e).find('.fixed_shoot_down').text('-');
			$(e).find('.minimum_shoot_down').text('-');
		}
		else {
			$(e).find('.rate_shoot_down').text((rate * 100).toFixed(1) + '%');
			$(e).find('.fixed_shoot_down').text(fixed + '機');
			$(e).find('.minimum_shoot_down').text('1機');
		}

		maxFixedList.push(0);
		minFixedList.push(9999);
	});

	// 対空カットイン選択欄読込
	$('#antiair_cutin_inputs').find('tr').each((i, e) => {
		const cutinRate = castFloat($(e).find('.cutin_rate').val());
		if (cutinRate <= 0) return;

		const cutIn = ANTIAIR_CUTIN.find(v => v.id === castInt($(e).find('.select_antiair_cutin_td').val()));
		const stage2 = [];
		for (let i = 0; i < inputAntiAirWeights.length; i++) {
			const weight = inputAntiAirWeights[i];
			if (weight === 0) continue;

			// 連合補正
			let adj = 1.0;
			if (isGrand) {
				if (i < 6) adj = isAirRaid ? 0.78 : 0.8;
				else adj = 0.48
			}
			const bonus = cutIn ? cutIn.adj[0] : 1.0;
			const rate = weight * adj / 400;
			const fixed = Math.floor(((weight + fleetAntiAir) * adj * bonus) / 10);
			let minimun = 1 + (cutIn ? cutIn.adj[1] : 0);

			stage2.push([rate, fixed, minimun]);

			if (maxFixedList[i] < fixed) maxFixedList[i] = fixed;
			if (minFixedList[i] > fixed) minFixedList[i] = fixed;
			if (maxMinimum < minimun) maxMinimum = minimun;
			if (minMinimum > minimun) minMinimum = minimun;
		}
		fleetStage2Table.push({ cutinId: cutIn ? cutIn.id : 0, rate: cutinRate, table: stage2, border: 0 });
	});

	$('#antiair_weight_inputs').find('tr:not(.d-none)').each((i, e) => {
		if (inputAntiAirWeights[i] > 0) {
			if (minFixedList[i] === maxFixedList[i]) {
				$(e).find('.fixed_shoot_down').text(`${minFixedList[i]}機`);
			}
			else {
				$(e).find('.fixed_shoot_down').text(`${minFixedList[i]}~${maxFixedList[i]}機`);
			}

			if (minMinimum === maxMinimum) {
				$(e).find('.minimum_shoot_down').text(`${minMinimum}機`);
			}
			else {
				const avg = getArraySum(fleetStage2Table.map(v => v.table[0][2])) / fleetStage2Table.length;
				$(e).find('.minimum_shoot_down').text(`${minMinimum}~${maxMinimum}機(${avg.toFixed(1)}機)`);
			}

		}
	});


	// 各対空CIの発動条件の設定 [0 ~ 100) のうち発動する区間のボーダー
	let sum = 0;
	for (const data of fleetStage2Table) {
		sum += data.rate;
		data.border = sum;
	}
}

/**
 * 艦隊防空値変更
 */
function fleet_antiair_base_TextChanged() {
	const input = validateInputNumberFloat($('#fleet_antiair_base').val(), 999.9, 0);
	if (input !== $('#fleet_antiair_base').val()) $('#fleet_antiair_base').val(input);

	const formation = castInt($('#fleet_antiair_formation').val());
	if (formation > 10) $('#fleet_antiair_formation').val(11);
	else $('#fleet_antiair_formation').val(1);

	updateFleetStage2Table();
}

/**
 * 艦隊防空値直接入力
 */
function fleet_antiair_TextChanged() {
	const input = validateInputNumberFloat($('#fleet_antiair').val(), 999.9, 0);
	if (input !== $('#fleet_antiair').val()) $('#fleet_antiair').val(input);

	$('#fleet_antiair_base').val(input);
	const formation = castInt($('#fleet_antiair_formation').val());
	if (formation > 10) $('#fleet_antiair_formation').val(11);
	else $('#fleet_antiair_formation').val(1);

	updateFleetStage2Table();
}

/**
 * 一括取り込み文字変更 貼り付けなど
 */
function import_antiair_Changed() {
	let input = document.getElementById('import_antiair').value;
	input = input.replace('、', ',');
	input = input.replace(/\s/g, ',');
	input = input.replace(/\t/g, ',');
	input = input.replace(/\n/g, ',');
	document.getElementById('import_antiair').value = input;
}

/**
 * 一括加重対空取り込み　ボタンクリック
 */
function btn_import_antiair_Clicked() {
	const input = document.getElementById('import_antiair').value.trim();
	const inputs = input.split(',');

	let index = 0;
	for (const v of inputs) {
		if (!v) continue;
		if (index >= document.getElementsByClassName('antiair_weight').length) break;
		document.getElementsByClassName('antiair_weight')[index++].value = castInt(v);
	}
	if (index < 11) {
		for (let i = index; i < 12; i++) {
			document.getElementsByClassName('antiair_weight')[i].value = 0;
		}
	}
	document.getElementById('import_antiair').value = '';
	updateFleetStage2Table();
}


/**
 * 対空CI種別追加
 * @param {JQuery} $this
 */
function antiAirCutinChanged($this, updateTable = true) {
	const $tr = $this.closest('tr');
	if (!$tr.hasClass('added')) {
		const trText = $tr.html();

		const tr = document.createElement('tr');
		tr.innerHTML = trText;
		const td = tr.getElementsByClassName('cutin_rate')[0];
		td.value = 0;
		$this.closest('tbody')[0].appendChild(tr);

		// 選択されたCIの発動率欄を有効化
		$tr.find('.cutin_rate').prop('readonly', false);
		// 削除行の追加
		$tr.find('.btn_remove_cutin').html('<i class="fas fa-trash-o"></i>');
		$tr.find('.btn_remove_cutin').addClass('cur_pointer');
		$tr.addClass('added');
	}

	if (updateTable) updateFleetStage2Table();
}

/**
 * 対空カットイン発動率変更
 * @param {JQuery} $this
 */
function updateAntiAirCutinRate($this) {
	// 0 ~ 100までの基本入力検証
	const input = validateInputNumberFloat($this.val(), 100, 0);
	if (input != $this.val()) $this.val(input);
	if (input == 0) $this.val(0);
	const inputValue = castFloat($this.val()) * 100;

	// 確率の総和を取得
	let sum = 0;
	const cutin_rates = document.getElementsByClassName('cutin_rate');
	// 不発の発動率を0に修正
	document.getElementsByClassName('cutin_rate')[cutin_rates.length - 1].value = 0;
	for (let i = 0; i < cutin_rates.length; i++) {
		sum += Math.round(100 * cutin_rates[i].value);
	}

	// 超過
	if (sum > 10000) {
		// 差っ引く
		$this.val((inputValue - (sum - 10000)) / 100);
	}
	else {
		// 余り値を不発に割り当て
		document.getElementsByClassName('cutin_rate')[cutin_rates.length - 1].value = Math.round(10000 - sum) / 100;
	}

	updateFleetStage2Table();
}

/**
 * 対空CI削除
 * @param {JQuery} $this
 */
function btn_remove_cutin_Clicked($this) {
	// 削除する分の発動率は不発にする
	const delValue = castFloat($this.closest('tr').find('.cutin_rate').val());
	$this.closest('tr').remove();
	const $noCutin = $('#antiair_cutin_inputs tr:last()').find('.cutin_rate');
	$noCutin.val(castFloat($noCutin.val()) + delValue);

	if ($('#antiair_cutin_inputs tr').length === 1) {
		$noCutin.val(100);
	}
	updateFleetStage2Table();
}

/**
 * 対空CI表示絞り
 * @param {JQuery} $this
 */
function cutin_visible_Clicked($this) {

	const cutin = castInt($this[0].dataset.cutinid);
	if ($this.hasClass('disabled')) {
		// 無効化解除
		$this.removeClass('disabled');
		$this.find('.fa-eye-slash').removeClass('fa-eye-slash').addClass('fa-eye');
		setting.invisibleCutin = setting.invisibleCutin.filter(v => v !== cutin);

		$('.select_antiair_cutin_td').each((i, e) => {
			$(e).find(`option[value=${cutin}]`).removeClass('d-none');
		});
	}
	else {
		// 無効化
		$this.addClass('disabled');
		$this.find('.fa-eye').removeClass('fa-eye').addClass('fa-eye-slash');
		setting.invisibleCutin.push(cutin);

		$('.select_antiair_cutin_td').each((i, e) => {
			$(e).find(`option[value=${cutin}]`).addClass('d-none');
		});
	}
	saveSetting();
}

/**
 * 入力した対空砲火情報のクリア
 */
function resetFleetAntiairInput() {
	$('#modal_fleet_antiair_input input').val(0);

	$('#fleet_antiair_formation').val($('#antiair_grand').prop('checked') ? 11 : 1);
	$('#antiair_cutin_inputs tr:last()').find('.cutin_rate').val(100);

	updateFleetStage2Table();
}

/**
 * 対空砲火テーブル　連合トグル
 */
function antiair_grand_Changed() {
	const formation = castInt($('#fleet_antiair_formation').val());
	if ($('#antiair_grand').prop('checked')) {
		// 連合時
		$('#modal_fleet_antiair_input').find('.escort_fleet').removeClass('d-none');
		$('#antiair_air_raid').parent().removeClass('d-none');
		$('.hidden_text').removeClass('d-none');
		$('#fleet_antiair_formation').find('option').each((i, e) => {
			if (castInt($(e).val()) > 10) $(e).removeClass('d-none');
			else $(e).addClass('d-none');
		});

		if ([1, 2, 3, 5].includes(formation)) {
			$('#fleet_antiair_formation').val(formation + 10);
		}
		else if (formation < 10) $('#fleet_antiair_formation').val(11);
	}
	else {
		// 通常時
		$('#modal_fleet_antiair_input').find('.escort_fleet').addClass('d-none');
		$('#antiair_air_raid').parent().addClass('d-none');
		$('.hidden_text').addClass('d-none');
		$('#fleet_antiair_formation').find('option').each((i, e) => {
			if (castInt($(e).val()) > 10) $(e).addClass('d-none');
			else $(e).removeClass('d-none');
		});

		if ([11, 12, 13, 15].includes(formation)) {
			$('#fleet_antiair_formation').val(formation - 10);
		}
		else if (formation > 10) $('#fleet_antiair_formation').val(11);
	}

	updateFleetStage2Table();
}

/**
 * 基地リセットボタン押下時
 * @param {JQuery} $this
 */
function btn_reset_landBase_Clicked($this) {
	const $landBase = $this.closest('.lb_tab');
	$landBase.find('.lb_plane').each((i, e) => {
		$(e).find('.slot').text(0);
		setLBPlaneDiv($(e));
	});
	$this.blur();
	calculate();
}

/**
 * 基地航空隊 機体ドラッグ終了時
 * @param {JQuery} $this
 */
function lb_plane_DragEnd($this) {
	const $plane = $this.closest('.lb_plane');
	if (isOut) {
		// 選択状況をリセット
		clearPlaneDiv($plane);
		$plane.css('opacity', '0.0');
		isOut = false;
	}
	$plane.animate({ 'opacity': '1.0' }, 500);
	calculate();
}

/**
 * 基地欄へ機体ドロップ時
 * @param {JQuery} $this
 * @param {*} ui
 */
function lb_plane_Drop($this, ui) {
	const $original = ui.draggable;

	if ($original.attr('class').includes('plane_tr_draggable')) {
		const plane = { id: castInt($original[0].dataset.planeid), remodel: castInt($original[0].dataset.remodel) };
		setLBPlaneDiv($this, plane);

		// お札が待機になってるなら集中または防空に変更
		const $ohuda = $this.closest('.lb_tab').find('.ohuda_select');
		if ($ohuda && castInt($ohuda.val()) < 0) {
			$ohuda.val(isDefMode ? 0 : 2);
		}

		calculate();
		createDraggablePlaneTable();
		return;
	}

	const insertPlane =
	{
		id: castInt($original[0].dataset.planeid),
		remodel: castInt($original.find('.remodel_value')[0].textContent),
		prof: castInt($original.find('.prof_select')[0].dataset.prof),
		slot: castInt($original.find('.slot').text())
	};
	const prevPlane = {
		id: castInt($this[0].dataset.planeid),
		remodel: castInt($this.find('.remodel_value')[0].textContent),
		prof: castInt($this.find('.prof_select')[0].dataset.prof),
		slot: castInt($this.find('.slot').text())
	};

	setLBPlaneDiv($this, insertPlane);

	// 交換
	if (!isCtrlPress && !$('#drag_drop_copy').prop('checked')) {
		setLBPlaneDiv($original, prevPlane);
	}
}


/**
 * 三角ボタンクリック時 表示情報のトグル
 * @param {JQuery} $this
 */
function btn_toggle_lb_info_Clicked($this) {
	const $tab = $this.closest('.lb_infomation');

	if ($this.hasClass('show_resource')) {
		// 通常表示に切り替え
		$this.removeClass('show_resource');
		if (isDefMode) $this.addClass('ml-auto');
		$tab.find('.battle_only').addClass('ml-auto').removeClass('ml-2');
		$tab.find('.btn_show_contact_rate_lb').removeClass('d-none');
		$tab.find('.ap_detail').removeClass('d-none');
		$tab.find('.resource').addClass('d-none');
	}
	else {
		// 資源の表示に切り替え
		$this.addClass('show_resource').removeClass('ml-auto');
		$tab.find('.battle_only').removeClass('ml-auto').addClass('ml-2');
		$tab.find('.btn_show_contact_rate_lb').addClass('d-none');
		$tab.find('.ap_detail').addClass('d-none');
		$tab.find('.resource').removeClass('d-none');
	}
}

/**
 * 防空モード切り替えボタン変更時
 */
function toggle_def_mode_Checked() {
	isDefMode = document.getElementById('toggle_def_mode').checked;
	calculate();
}

/**
 * 防空モード状態を変更する
 * @param {boolean} defMode trueなら防空計算モードにする
 */
function toggleDefenseMode(defMode) {
	document.getElementById('toggle_def_mode').checked = defMode;
	isDefMode = defMode;
}

/**
 * 艦娘装備リセットボタン押下時
 * @param {JQuery} $this
 */
function btn_reset_ship_plane_Clicked($this) {
	$this.closest('.ship_tab').find('.ship_plane').each((i, e) => { clearPlaneDiv($(e)) });
	calculate();
}

/**
 * 艦娘 機体ドラッグ開始時
 * @param {*} ui
 */
function ship_plane_DragStart(ui) {
	$(ui.helper)
		.addClass('ship_plane ' + getPlaneCss(castInt($(ui.helper).find('.plane_img').attr('alt'))))
		.css('width', 320);
	$(ui.helper).find('.slot_select_parent').remove();
	$(ui.helper).find('.btn_remove_plane').remove();
	$(ui.helper).find('.plane_lock').remove();
	$(ui.helper).find('.plane_unlock').remove();
	$(ui.helper).find('.prof_select_parent').addClass('mr-2');
}

/**
 * 艦娘 機体ドラッグ終了時
 * @param {JQuery} $this
 */
function ship_plane_DragEnd($this) {
	const $plane = $this.closest('.ship_plane');
	if (isOut) {
		// 選択状況をリセット
		clearPlaneDiv($plane);
		$plane.css('opacity', '0.0');
		isOut = false;
	}
	$plane.animate({ 'opacity': '1.0' }, 500);

	calculate();
}

/**
 * 艦娘 機体がドロップ対象上に位置
 * @param {JQuery} $this ドロップ対象 (!= ドラッグ中機体)
 * @param {*} ui
 */
function ship_plane_DragOver($this, ui) {
	const $original = ui.draggable.hasClass('plane_tr_draggable') ? ui.draggable : ui.draggable.closest('.ship_plane');
	const shipID = castInt($this.closest('.ship_tab')[0].dataset.shipid);
	const planeID = castInt($original[0].dataset.planeid);
	const type = castInt($original[0].dataset.type);
	// 挿入先が装備不可だった場合暗くする
	if (!checkInvalidPlane(shipID, getPlanes(type).find(v => v.id === planeID))) {
		ui.helper.stop().animate({ 'opacity': '0.2' }, 100);
		$this.removeClass('plane_draggable_hover');
		isOut = true;
	}
	else {
		ui.helper.stop().animate({ 'opacity': '1.0' }, 100);
		isOut = false;
	}
}

/**
 * 艦娘欄へ機体ドロップ時
 * @param {JQuery} $this
 * @param {*} ui
 */
function ship_plane_Drop($this, ui) {

	const $d = ui.draggable;
	if ($d.attr('class').includes('plane_tr_draggable')) {
		const plane = { id: castInt($d[0].dataset.planeid), remodel: castInt($d[0].dataset.remodel) };
		// 挿入先が装備不可だった場合中止
		let shipID = castInt($this.closest('.ship_tab')[0].dataset.shipid);
		if (!checkInvalidPlane(shipID, PLANE_DATA.find(v => v.id === plane.id))) return;

		setPlaneDiv($this, plane);
		calculate();
		createDraggablePlaneTable();
		return;
	}

	// 機体入れ替え
	if (ui.draggable.closest('.ship_plane')[0].dataset.planeid) {
		const $original = ui.draggable.closest('.ship_plane');
		const insertPlane = {
			id: castInt($original[0].dataset.planeid),
			remodel: castInt($original.find('.remodel_value')[0].textContent),
			prof: castInt($original.find('.prof_select')[0].dataset.prof)
		};
		const prevPlane = {
			id: castInt($this[0].dataset.planeid),
			remodel: castInt($this.find('.remodel_value')[0].textContent),
			prof: castInt($this.find('.prof_select')[0].dataset.prof)
		};

		// 挿入先が装備不可だった場合中止
		let shipID = castInt($this.closest('.ship_tab')[0].dataset.shipid);
		if (!checkInvalidPlane(shipID, PLANE_DATA.find(v => v.id === insertPlane.id))) return;

		// 挿入
		setPlaneDiv($this, insertPlane);

		if (!isCtrlPress && !$('#drag_drop_copy').prop('checked')) {
			// 交換を行う
			setPlaneDiv($original, prevPlane);
		}
	}
}

/**
 * 戦闘形式変更時
 * @param {JQuery} $this
 */
function cell_type_Changed($this, calc = true) {
	const $parentContent = $this.closest('.battle_content');
	const cellType = castInt($this.val());
	$parentContent.find('.enemy_content').each((i, e) => {
		if (cellType !== CELL_TYPE.grand && i > 5) $(e).addClass('d-none').removeClass('d-flex');
		else $(e).removeClass('d-none').addClass('d-flex');
	});

	const $formation = $parentContent.find('.formation');
	changeFormationSelectOption($formation, cellType);

	if (calc) calculate();
}

/**
 * 陣形選択欄の読み込み
 * @param {JQuery} $formation 変更する .formation クラス
 * @param {number} cellType セル戦闘種別
 */
function changeFormationSelectOption($formation, cellType) {
	const prevVal = castInt($formation.val());
	$formation.find('option').each((i, e) => {
		if (cellType !== CELL_TYPE.grand) {
			if ($(e).val() < 10) $(e).removeClass('d-none');
			if ($(e).val() > 10) $(e).addClass('d-none');
			if (prevVal > 10) $formation.val(prevVal - 10);
		}
		if (cellType === CELL_TYPE.grand) {
			if ($(e).val() < 10) $(e).addClass('d-none');
			if ($(e).val() > 10) $(e).removeClass('d-none');
			if (prevVal === 4) $formation.val(11);
			else $formation.val(prevVal + 10);
		}
	});
}

/**
 * 機体選択欄 機体カテゴリ変更時
 */
function plane_type_select_Changed($this = null) {
	if (!$this) $this = $('#plane_type_select').find('.active');
	// 選択時のカテゴリ
	let selectedType = castInt($this.length ? $this[0].dataset.type : 0);
	// ベース機体一覧
	let org = getPlanesForIcon(selectedType);
	// 検索語句
	let searchWord = $('#plane_word').val().trim();
	// 現状のカテゴリ
	let dispType = [];
	$('#plane_type_select').find('.nav-link:not(.disabled)').each((i, e) => {
		const typeId = castInt($(e)[0].dataset.type);
		dispType.push(typeId);
		if (typeId === 3) dispType.push(9);
		else if (typeId === 4) dispType.push(104);
		else if (typeId === 5) dispType = dispType.concat([6, 7, 8]);
	});

	// 特定の艦娘が選ばれている場合の調整
	if ($target && $target.attr('class').includes('ship_plane') && $target.closest('.ship_tab')[0].dataset.shipid) {
		const ship = SHIP_DATA.find(v => v.id === castInt($target.closest('.ship_tab')[0].dataset.shipid));
		const basicCanEquip = LINK_SHIP_EQUIPMENT.find(v => v.type === ship.type);
		const special = SPECIAL_LINK_SHIP_EQUIPMENT.find(v => v.shipId === ship.id);
		dispType = basicCanEquip.e_type.concat();
		if (special) dispType = dispType.concat(special.equipmentTypes);

		if (!dispType || !dispType.includes(selectedType)) {
			selectedType = 0;
			org = getPlanesForIcon(selectedType);
		}

		// 試製景雲削除
		org = org.filter(v => v.id !== 151);

		// 特別装備可能な装備カテゴリ対応
		if (special && special.equipmentTypes.length > 0) dispType = dispType.concat(special.equipmentTypes);

		// 重複を切る
		dispType = dispType.filter((x, i, self) => self.indexOf(x) === i);
		dispType.sort((a, b) => a - b);

		// カテゴリ一覧にないもの除外
		org = org.filter(v => dispType.includes(Math.abs(v.type)));

		// 特別装備可能な装備対応
		if (special && special.equipmentIds.length > 0) {
			for (const id of special.equipmentIds) {
				const plane = PLANE_DATA.find(v => v.id === id);
				dispType.push(plane.type);

				// もしまだ追加されてないなら追加
				if (!org.find(v => v.id === id) && (selectedType === 0 || selectedType === plane.type)) org.push(plane);
			}
		}

		// 装備可能カテゴリ表示変更
		$('#plane_type_select').find('.nav-link').each((i, e) => {
			const typeId = castInt($(e)[0].dataset.type);
			if (typeId === selectedType) $(e).addClass('active');
			else $(e).removeClass('active');

			if (typeId !== 0 && !dispType.includes(typeId)) $(e).addClass('disabled d-none');
		});
	}
	else if ($target && $target.attr('class').includes('ship_plane')) {
		// 艦娘だけど自由
		org = org.filter(v => v.type !== 104);
		org = org.filter(v => dispType.includes(Math.abs(v.type)));
	}

	if (searchWord) {
		searchWord = replaceKnji(searchWord);
		org = org.filter(v => v.name.includes(searchWord) || v.abbr.includes(searchWord));
	}

	// 個別表示対応
	if (setting.inStockOnly && setting.isDivideStock) {
		// 所持数ロード
		const stock = loadPlaneStock();
		const newPlanes = [];
		// 既存品ベースに所持品検索
		for (const o of org) {
			const x = stock.find(v => v.id === o.id);
			for (let i = 0; i <= 10; i++) {
				const stockCount = x.num[i];
				if (stockCount === 0) continue;

				// 改修値0～10で見つかったものを個数とともに格納
				const plane = Object.assign({ remodel: i, count: stockCount }, o);
				// ボーナス雷装
				plane.torpedo += Plane.getBonusTorpedo(plane.type, plane.remodel);
				// ボーナス爆装
				plane.bomber += Plane.getBonusBomber(plane.type, plane.remodel, plane.antiAir);
				// ボーナス対空
				plane.antiAir += Plane.getBonusAntiAir(plane.id, plane.type, plane.remodel, plane.antiAir);
				newPlanes.push(plane);
			}
		}
		org = newPlanes.concat();
	}

	// ソート反映
	const sortKey = $('#plane_sort_select').val();
	switch (sortKey) {
		case 'battle_anti_air':
			org.sort((a, b) => (b.antiAir + 1.5 * b.interception) - (a.antiAir + 1.5 * a.interception));
			break;
		case 'defense_anti_air':
			org.sort((a, b) => (b.antiAir + b.interception + 2.0 * b.antiBomber) - (a.antiAir + a.interception + 2.0 * a.antiBomber));
			break;
		case 'land_base_power':
			org.sort((a, b) => getLandBasePower(b.id, 18, 0) - getLandBasePower(a.id, 18, 0));
			break;
		case 'radius':
			org.sort((a, b) => b.radius - a.radius);
			break;
		case 'history':
			if (setting.selectedHistory[0]) {
				const lst = setting.selectedHistory[0];
				org.sort((a, b) => lst.filter(v => v === b.id).length - lst.filter(v => v === a.id).length);
			}
		case 'id':
		case 'cost':
			org.sort((a, b) => a[sortKey] - b[sortKey]);
			break;
		case 'default':
			break;
		default:
			// その他降順
			org.sort((a, b) => b[sortKey] - a[sortKey]);
			break;
	}

	// フィルタ反映
	const filterKey = $('#plane_filter_key_select').val();
	const filterValue = castInt($('#plane_filter_value').val());
	switch (filterKey) {
		case 'battle_anti_air':
			org = org.filter(v => (v.antiAir + 1.5 * v.interception) >= filterValue);
			break;
		case 'defense_anti_air':
			org = org.filter(v => (v.antiAir + v.interception + 2.0 * v.antiBomber) >= filterValue);
			break;
		default:
			org = org.filter(v => v[filterKey] >= filterValue);
			break;
	}

	createPlaneTable(org);
}

/**
 * 検索語句が変更された(機体)
 */
function plane_word_TextChanged() {
	if (timer !== false) clearTimeout(timer);
	timer = setTimeout(function () { plane_type_select_Changed(); }, 250);
}

/**
 * お気に入りのみ表示クリック時
 */
function fav_only_Checked_Chenged() {
	setting.favoriteOnly = $('#fav_only').prop('checked');
	saveSetting();
	plane_type_select_Changed();
}

/**
 * 在庫有のみ表示クリック時
 */
function disp_in_stock_Checked_Chenged() {
	setting.inStockOnly = $('#disp_in_stock').prop('checked');
	saveSetting();
	plane_type_select_Changed();
}

/**
 * 個別表示クリック時
 */
function divide_stock_Checked_Chenged() {
	setting.isDivideStock = $('#divide_stock').prop('checked');
	saveSetting();
	plane_type_select_Changed();
}

/**
 * 配備済みも表示クリック時
 */
function disp_equipped_Checked_Chenged() {
	setting.visibleEquipped = $('#disp_equipped').prop('checked');
	saveSetting();
	plane_type_select_Changed();
}

/**
 * 基地機体はずすボタンクリック時
 * @param {JQuery} $this
 */
function btn_remove_lb_plane_Clicked($this) {
	const $plane = $this.closest('.lb_plane');
	clearPlaneDiv($plane);
	$plane.find('.slot').text(0);
	$plane.find('.slot_input').attr('max', 0);
	$plane.find('.slot_range').attr('max', 0);

	calculate();
}

/**
 * 各種選択欄　表示形式クリック時
 * @param {JQuery} $this
 */
function toggle_display_type_Clicked($this) {
	const $parentModal = $this.closest('.modal');
	$parentModal.find('.toggle_display_type').removeClass('selected');
	$this.addClass('selected');

	setting.displayMode[$parentModal.attr('id')] = $this.data('mode');
	saveSetting();
	$parentModal.find('select').change();
}

/**
 * 各種選択欄　ソート変更時
 * @param {JQuery} $this
 */
function sort_Changed($this) {
	const $parentModal = $this.closest('.modal');
	const sortKey = $parentModal.find('.sort_select').val();
	const sortTargetId = $target.closest('.contents').attr('id');
	if (sortTargetId) {
		setting.orderBy[sortTargetId] = sortKey;
		saveSetting();
	}
	if ($parentModal.attr('id') === 'modal_plane_select') plane_type_select_Changed();
}

/**
 * 艦載機選択欄　フィルタ変更時
 */
function plane_filter_Changed() {
	const filterKey = $('#plane_filter_key_select').val();
	const filterValue = castInt($('#plane_filter_value').val());
	const filterTargetId = $target.closest('.contents').attr('id');

	if (filterTargetId) {
		setting.planeFilter[filterTargetId] = [filterKey, filterValue];
		saveSetting();
	}

	plane_type_select_Changed();
}

/**
 * 機体名クリック時 (モーダル展開処理)
 * @param {JQuery} $this
 */
function plane_name_Clicked($this) {
	// 機体選択画面の結果を返却するターゲットのdiv要素を取得
	$target = $this.closest('.lb_plane');
	if (!$target.attr('class')) $target = $this.closest('.ship_plane');

	const selectedID = castInt($target[0].dataset.planeid);
	let activeTypeId = castInt($('#plane_type_select').find('.active')[0].dataset.type);

	// いったん全部出す
	$('#plane_type_select').find('.nav-link').each((i, e) => { $(e).removeClass('disabled d-none'); });

	if ($target.attr('class').includes('ship_plane')) {
		// カテゴリ：陸上機 が選択されていたら全てにする
		if (activeTypeId > 100) activeTypeId = 0;

		// 陸上機を非表示に
		$('#plane_type_select').find('.nav-link').each((i, e) => {
			const typeId = castInt($(e)[0].dataset.type);
			if (typeId > 100) $(e).addClass('disabled d-none');

			// 選択変更
			if (typeId === activeTypeId) $(e).addClass('active');
			else $(e).removeClass('active');
		});
	}

	const selectParent = $target.closest('.contents').attr('id');
	if (selectParent) {
		// ソート復元
		$('#modal_plane_select').find('.sort_select').val(setting.orderBy[selectParent]);
		// フィルタ復元
		$('#plane_filter_key_select').val(setting.planeFilter[selectParent][0]);
		$('#plane_filter_value').val(setting.planeFilter[selectParent][1]);
	}

	plane_type_select_Changed();
	$('#modal_plane_select').find('.btn_remove').prop('disabled', selectedID === 0);
	$('#modal_plane_select').modal('show');
}

/**
 * モーダル内機体選択時
 * @param {JQuery} $this
 */
function modal_plane_Selected($this) {
	const plane = { id: castInt($this[0].dataset.planeid), remodel: castInt($this[0].dataset.remodel) };
	if ($target.attr('class').includes('lb_plane')) {
		// 基地航空隊に機体セット
		setLBPlaneDiv($target, plane);
		// お札が待機になってるなら集中または防空に変更
		const $ohuda = $target.closest('.lb_tab').find('.ohuda_select');
		if ($ohuda && castInt($ohuda.val(), -1) < 0) {
			$ohuda.val(isDefMode ? 0 : 2);
		}
	}
	// 艦娘に機体セット
	else if ($target.attr('class').includes('ship_plane')) {
		setPlaneDiv($target, plane);
	}
	if (plane.id) updatePlaneSelectedHistory(plane.id);
	$('#modal_plane_select').modal('hide');
}

/**
 * モーダル内機体はずすクリック時
 * @param {JQuery} $this
 */
function modal_plane_select_btn_remove_Clicked($this) {
	if ($this.prop('disabled')) return false;
	clearPlaneDiv($target);
	$('#modal_plane_select').modal('hide');
}

/**
 * 機体プリセット展開クリック時
 * @param {JQuery} $this
 */
function btn_plane_preset_Clicked($this) {
	let parentId = -1;
	$target = $this.closest('.lb_tab');
	if (!$target.attr('class')) {
		// 艦娘が展開先である場合
		$target = $this.closest('.ship_tab');
		parentId = castInt($target[0].dataset.shipid);
	}
	$('#modal_plane_preset').data('parentid', parentId);
	loadPlanePreset();
	$('#modal_plane_preset').modal('show');
	$this.blur();
}

/**
 * 機体プリセット内 プリセット一覧名クリック
 * @param {JQuery} $this
 */
function plane_preset_tr_Clicked($this) {
	const preset = planePreset.find(v => v.id === castInt($this.data('presetid')));
	$('.preset_tr').removeClass('preset_selected');
	$this.addClass('preset_selected');
	drawPlanePresetPreview(preset);
}

/**
 * プリセット名変更時
 * @param {JQuery} $this
 */
function preset_name_Changed($this) {
	// 入力検証　全半40文字くらいで
	const input = $this.val().trim();
	const $btn = $this.closest('.modal').find('.btn_commit_preset');
	if (input.length > 50) {
		$this.addClass('is-invalid');
		$btn.prop('disabled', true);
	}
	else if (input.length === 0) {
		$this.addClass('is-invalid');
		$btn.prop('disabled', true);
	}
	else {
		$this.removeClass('is-invalid');
		$this.addClass('is-valid');
		$btn.prop('disabled', false);
	}
}

/**
 * 機体プリセット内 プリセット保存クリック時
 * @param {JQuery} $this
 */
function btn_commit_plane_preset_Clicked($this) {
	$this.prop('disabled', true);
	// プリセット変更 & 保存
	updatePlanePreset();
	loadPlanePreset();
}

/**
 * 機体プリセット内 プリセット削除クリック時
 * @param {JQuery} $this
 */
function btn_delete_plane_preset_Clicked($this) {
	$this.prop('disabled', true);
	deletePlanePreset();
	loadPlanePreset();
}

/**
 * 機体プリセット内 プリセット展開クリック時
 */
function btn_expand_plane_preset_Clicked() {
	const presetId = castInt($('.preset_selected').data('presetid'));
	const preset = planePreset.find(v => v.id === presetId);
	if (preset) {
		// プリセット展開
		if ($target.attr('class').includes('lb_tab')) {
			$target.find('.lb_plane').each((i, e) => {
				const plane = { id: 0, remodel: 0 };
				if (preset.planes.length > i) {
					plane.id = preset.planes[i].id;
					plane.remodel = preset.planes[i].remodel;
					setLBPlaneDiv($(e), plane);
				}
			});
			// お札が待機になってるなら集中または防空に変更
			$target.find('.ohuda_select').val(isDefMode ? 0 : 2);
		}
		else {
			$target.find('.ship_plane').each((i, e) => {
				const plane = { id: 0, remodel: 0 };
				if (preset.planes.length > i) {
					plane.id = preset.planes[i].id;
					plane.remodel = preset.planes[i].remodel;
					setPlaneDiv($(e), plane);
				}
			});
		}
	}
	$('#modal_plane_preset').modal('hide');
}

/**
 * 表示隻数変更時
 * @param {JQuery} $this .display_ship_count
 * @param {boolean} cancelCalculate 計算を行わない場合はtrue
 */
function display_ship_count_Changed($this, cancelCalculate = false) {
	const displayCount = $this.val();
	$this.closest('.friendFleet_tab').find('.ship_tab').each((i, e) => {
		if (i < displayCount) $(e).removeClass('d-none');
		else $(e).addClass('d-none');
	});

	if (!cancelCalculate) calculate();
}

/**
 * 艦娘機体はずすボタンクリック時
 * @param {JQuery} $this
 */
function btn_remove_ship_plane_Clicked($this) {
	clearPlaneDiv($this.closest('.ship_plane'));
	calculate();
}

/**
 * 艦隊表示変更時
 */
function fleet_select_tab_Clicked() {
	if (!$('#union_fleet').prop('checked')) calculate();
}

/**
 * 艦娘無効クリック
 * @param {JQuery} $this
 */
function ship_disabled_Changed($this) {
	if ($this.hasClass('disabled')) {
		// 有効にする
		$this.closest('.ship_tab').removeClass('opacity4');
		$this.removeClass('disabled');
		$this.children().removeClass('fa-eye-slash').addClass('fa-eye no_capture');
	}
	else {
		// 無効にする
		$this.closest('.ship_tab').addClass('opacity4');
		$this.addClass('disabled');
		$this.children().removeClass('fa-eye no_capture').addClass('fa-eye-slash');
	}
	calculate();
}

/**
 * 艦娘一覧モーダル展開クリック時
 * @param {JQuery} $this
 */
function ship_name_span_Clicked($this) {
	$target = $this.closest('.ship_tab');
	const selectedID = castInt($target[0].dataset.shipid);

	// 選択艦娘がいるなら
	if (selectedID) {
		$('#modal_ship_select').find('.btn_remove').prop('disabled', false);
	}
	else $('#modal_ship_select').find('.btn_remove').prop('disabled', true);
	$('#ship_type_select').change();
	$('#modal_ship_select').modal('show');
}

/**
 * 艦娘外す
 * @param {JQuery} $this
 */
function btn_remove_ship_Clicked($this) {
	clearShipDiv($this.closest('.ship_tab'));
	calculate();
}


/**
 * 検索語句が変更された(艦娘)
 */
function ship_word_TextChanged() {
	if (timer !== false) clearTimeout(timer);
	timer = setTimeout(function () { createShipTable(castInt($('#ship_type_select').val())); }, 250);
}

/**
 * 艦娘一覧モーダル 艦娘クリック時
 * @param {JQuery} $this
 */
function modal_ship_Selected($this) {
	const shipId = castFloat($this[0].dataset.shipid);
	setShipDiv($target, shipId);

	updateShipSelectedHistory(shipId);
	$('#modal_ship_select').modal('hide');
}

/**
 * 艦娘一覧モーダルはずすクリック時
 * @param {JQuery} $this
 */
function modal_ship_select_btn_remove_Clicked($this) {
	if ($this.prop('disabled')) return false;
	clearShipDiv($target);
	$('#modal_ship_select').modal('hide');
}

/**
 * 戦闘回数変更時
 * @param {JQuery} $this
 */
function battle_count_Changed($this) {
	// 敵入力欄生成
	createEnemyInput(castInt($this.val()));

	// なんらかの出撃基地があれば基地派遣設定ボタンを目立たせる
	$('#lb_tab_parent').find('.ohuda_select').each((i, e) => {
		if (castInt($(e).val()) === 2) {
			$('#btn_lb_target').removeClass('btn-outline-success');
			$('#btn_lb_target').addClass('btn-outline-danger');
			$('#lb_target_alert').removeClass('d-none');
		}
	});

	inform_warning('敵艦との交戦回数が変更されました。基地航空隊の派遣先を確認してください。');
	calculate();
}

/**
 * 基地派遣先決定ボタンの有効無効表示
 */
function btn_lb_target_Clicked() {
	// 現行の基地タゲを取得
	const landBaseAll = createLandBaseInstance(false);

	// リセット
	const btns = document.getElementById('land_base_target_buttons').getElementsByClassName('btn-sm');
	for (const element of btns) {
		element.classList.remove('active');
		element.getElementsByTagName('input')[0].checked = false;
		if (!element.classList.contains('btn-outline-secondary')) {
			element.classList.remove('disabled');
		}
	}

	// タゲをもとに、ボタンを光らせる 札が出撃以外なら無効化！
	for (const landBase of landBaseAll.landBases) {
		if (landBase.mode === 2) {
			const btn = document.getElementsByName(`lb${landBase.baseNo}_target`)[landBase.target[0]];
			if (btn) {
				btn.parentElement.classList.add('active');
				btn.checked = true;
			}
			const btn2 = document.getElementsByName(`lb${landBase.baseNo}_target2`)[landBase.target[1]];
			if (btn2) {
				btn2.parentElement.classList.add('active');
				btn2.checked = true;
			}
		}
		else {
			for (const element of document.getElementsByName(`lb${landBase.baseNo}_target`)) {
				element.parentElement.classList.add('disabled');
			}
			for (const element of document.getElementsByName(`lb${landBase.baseNo}_target2`)) {
				element.parentElement.classList.add('disabled');
			}
		}
	}

	// 基地派遣設定ボタンの色を戻す
	$('#btn_lb_target').removeClass('btn-outline-danger');
	$('#btn_lb_target').addClass('btn-outline-success');
	$('#lb_target_alert').addClass('d-none');

	$('#modal_lb_target').modal('show');
}

/**
 * 敵艦隊表示形式変更
 */
function enemy_fleet_display_mode_Changed() {
	const isDisplayImage = $('#enemy_fleet_display_image').prop('checked');
	$('.enemy_content').each((i, e) => {
		if (isDisplayImage) {
			$(e).removeClass('py-0_5').addClass('pb-0_1 min-h-31px');
			$(e).find('.enemy_name_img_parent').removeClass('d-none').addClass('d-flex');
			$(e).find('.enemy_name_text').addClass('d-none');
		}
		else {
			$(e).removeClass('pb-0_1 min-h-31px').addClass('py-0_5');
			$(e).find('.enemy_name_img_parent').addClass('d-none').removeClass('d-flex');
			$(e).find('.enemy_name_text').removeClass('d-none');
		}
	});

	setting.enemyFleetDisplayImage = isDisplayImage;
	saveSetting();
}

/**
 * 戦闘全体リセット時
 * @param {JQuery} $this
 */
function btn_reset_battle_Clicked($this) {
	const $tmp = isDefMode ? $('#air_raid_enemies') : $this.closest('.battle_content');
	$tmp[0].dataset.celldata = '';
	$tmp.find('.enemy_content').each((i, e) => clearEnemyDiv($(e)));
	$this.blur();
	calculate();
}

/**
 * 検索語句が変更された(敵艦)
 */
function enemy_word_TextChanged() {
	if (timer !== false) clearTimeout(timer);
	timer = setTimeout(function () { createEnemyTable([castInt($('#enemy_type_select').val())]); }, 250);
}

/**
 * 敵艦名クリック時
 * @param {JQuery} $this
 */
function enemy_name_Clicked($this) {
	$target = $this;
	const selectedID = castInt($target[0].dataset.enemyid);
	$("#enemy_type_select").change();
	if (selectedID !== 0) $('#modal_enemy_select').find('.btn_remove').prop('disabled', false);
	else $('#modal_enemy_select').find('.btn_remove').prop('disabled', true);
	$('#modal_enemy_select').modal('show');
}

/**
 * 敵一覧モーダル 敵艦名クリック時
 * @param {JQuery} $this
 */
function modal_enemy_Selected($this) {
	// 敵艦セット
	setEnemyDiv($target, castInt($this[0].dataset.enemyid));
	$('#modal_enemy_select').modal('hide');
}

/**
 * 敵一覧モーダル 敵はずすクリック時
 * @param {JQuery} $this
 */
function modal_enemy_select_btn_remove($this) {
	if ($this.prop('disabled')) return false;
	// 選択状況をリセット
	clearEnemyDiv($target);
	$('#modal_enemy_select').modal('hide');
}


/**
 * 海域一括入力クリック
 */
function btn_world_expand_Clicked() {
	$target = $('.battle_content:first');
	$('#expand_target').text(1);
	$('#btn_expand_enemies').addClass('d-none');
	$('#btn_continue_expand').prop('disabled', true);
	$('#btn_continue_expand').removeClass('d-none');
	$('#expand_target_parent').removeClass('d-none');
	$('#enemy_pattern_tbody').html(``);
	$('#modal_enemy_pattern').modal('show');
}

/**
 * 海域一覧クリック時
 * @param {JQuery} $this
 */
function btn_enemy_preset_Clicked($this) {
	$target = $this.closest('.battle_content');
	if (isDefMode) $target = $('#air_raid_enemies');
	$('#btn_expand_enemies').removeClass('d-none');
	$('#btn_expand_enemies').prop('disabled', true);
	$('#btn_continue_expand').addClass('d-none');
	$('#expand_target_parent').addClass('d-none');
	$('#modal_enemy_pattern').modal('show');
}


/**
 * 対空砲火詳細クリック
 * @param {JQuery} $this
 */
function btn_stage2_Clicked($this) {
	const $battleContent = $this.closest('.battle_content');
	const battleNo = castInt($battleContent.find('.battle_no').text()) - 1;
	const formationId = castInt($battleContent.find('.formation').val());

	$('#modal_stage2_detail').data('battleno', battleNo);
	$('#modal_stage2_detail').data('formationid', formationId);

	calculateStage2Detail();
	$('#modal_stage2_detail').modal('show');
}

/**
 * 対空砲火シミュ内搭載数変更
 */
function stage2_slot_input_Changed() {
	const $this = $('#stage2_detail_slot');
	// 入力検証 -> 数値 かつ 0 以上 max 以下　違ってたら修正
	const value = validateInputNumber($this.val(), castInt($this.attr('max')));
	$this.val(value);
	calculateStage2Detail();
}

/**
 * 射撃回避補正任意調整
 * @param {JQuery} $this 
 */
function free_modify_input_Changed($this) {
	// 入力検証 -> 数値 かつ 0 以上 max 以下　違ってたら修正
	const value = validateInputNumberFloat($this.val(), castFloat($this.attr('max')));

	if ($this.val() !== value) $this.val(value);
	calculateStage2Detail();
}

/**
 * 簡易撃墜シミュレート
 */
function calculateStage2Detail() {
	const battleNo = castInt($('#modal_stage2_detail').data('battleno'));
	const formationId = castInt($('#modal_stage2_detail').data('formationid'));
	const all = updateEnemyFleetInfo(false);
	const battleData = all.battles[battleNo];
	const slot = castInt($('#stage2_detail_slot').val());
	const avoid = castInt($('#stage2_detail_avoid').val());
	let sumAntiAirBonus = 0;
	let tableHtml = '';
	let cutInWarnning = false;
	const cutInEnemy = [166, 167, 409, 410, 411, 412, 413, 414];

	// 自由入力欄活性化
	$('#free_modify').find('input').prop('readonly', avoid !== 5);
	if (avoid < 5) {
		$('#free_anti_air_weight').val(AVOID_TYPE[avoid].adj[0]);
		$('#free_anti_air_bornus').val(AVOID_TYPE[avoid].adj[1]);
	}

	let idx = 0;
	for (let index = 0; index < battleData.enemies.length; index++) {
		const enemy = battleData.enemies[index];
		if (enemy.id === 0) continue;
		const rate = Math.floor(slot * battleData.stage2[avoid][0][idx]);
		const fix = battleData.stage2[avoid][1][idx];
		const sum = rate + fix;
		if (cutInEnemy.includes(enemy.id)) cutInWarnning = true;
		sumAntiAirBonus += enemy.antiAirBonus;
		tableHtml += `
		<tr class="${sum >= slot ? 'stage2_table_death' : sum >= (slot / 2) ? 'stage2_table_half' : ''}">
			<td class="font_size_12 text-left td_enm_name" data-toggle="tooltip" data-html="true"
				data-title="<div><div>加重対空値：${enemy.antiAirWeight}</div><div>防空ボーナス：${enemy.antiAirBonus}</div></div>">
				<span class="ml-2">
					${drawEnemyGradeColor(enemy.name)}
				</span>
			</td>
			<td>
				<span class="text-right">
					${(battleData.stage2[avoid][0][idx++] * 100).toFixed(1)}% (${rate}機)</span>
			</td>
			<td>${fix}機</td>
			<td>${sum}機</td>
		</tr>
		`;
	}

	// 陣形補正
	const formation = FORMATION.find(v => v.id === formationId);
	const aj1 = formation ? formation.correction : 1.0;
	// 艦隊防空値 [陣形補正 * 各艦の艦隊対空ボーナス値の合計] * 2
	const sumfleetAntiAir = Math.floor(aj1 * sumAntiAirBonus) * 2;

	// 空襲なので撃墜ないよ注意
	if (battleData.cellType <= CELL_TYPE.grand) $('#is_air_raid').addClass('d-none');
	else $('#is_air_raid').removeClass('d-none');
	// 対空CIあるよ注意
	if (battleData.cellType <= CELL_TYPE.grand && cutInWarnning) $('#stage2_warning').removeClass('d-none');
	else $('#stage2_warning').addClass('d-none');

	$('#stage2_table tbody').html(tableHtml);
	$('.td_enm_name').tooltip();
	$('#stage2_detail_formation').text(formation.name);
	$('#sumfleetAntiAir').text(sumfleetAntiAir);
}

/**
 * 敵編成一覧名クリック時
 * @param {JQuery} $this
 */
function node_tr_Clicked($this) {
	$('.node_tr').removeClass('node_selected');
	$this.addClass('node_selected');
	createEnemyPattern();
}

/**
 * 敵編成パターン名クリック時
 * @param {JQuery} $this
 */
function pattern_Changed($this) {
	const pattern = castInt($this.data('disp'), -1);
	if (pattern < 0) return;
	createEnemyPattern(pattern);
}

/**
 * 敵艦表示モード変更時
 * @param {JQuery} $this
 */
function enemy_display_mode_Changed($this) {
	setting.enemyDisplayImage = $this.attr('id').includes('enemy_display_image');
	saveSetting();
	const pattern = castInt($('#enemy_pattern_select').find('.nav-link.active').data('disp'));
	if (pattern > 0) createEnemyPattern(pattern);
	else createEnemyPattern();
}

/**
 * マップ上のセルクリック時
 * @param {JQuery} $this
 */
function node_Clicked($this) {
	$('.node_tr').removeClass('node_selected');
	const $targetNode = $('.node_tr[data-node="' + $this.attr('title') + '"');
	$targetNode.addClass('node_selected');
	createEnemyPattern();
}

/**
 * マップ上のセルダブルクリック時
 */
function node_DoubleClicked() {
	// 選択マスがなければ何もしない(例外回避)
	if (!$('.node_tr').hasClass('node_selected')) return;
	if ($('#btn_expand_enemies').hasClass('d-none')) {
		btn_continue_expand_Clicked();
		$('.node_tr').removeClass('node_selected');
	}
	else {
		btn_expand_enemies();
	}
}

/**
 * 敵編成展開クリック時
 */
function btn_expand_enemies() {
	expandEnemy();
	$('#modal_enemy_pattern').modal('hide');
}

/**
 * 連続展開
 */
function btn_continue_expand_Clicked() {
	let currentBattle = castInt($('#expand_target').text());
	// 1戦目を入れた時点でクリアかける
	if (currentBattle === 1) {
		clearEnemyDivAll();
	}
	// 今から入れる分生成
	createEnemyInput(currentBattle);
	// 次の戦闘用意
	$('#expand_target').text(currentBattle + 1);

	$target = $(document.getElementsByClassName('battle_content')[currentBattle - 1]);
	// 通常通り展開
	expandEnemy();

	// 展開されたことを示す視覚効果
	$('#enemy_pattern_tbody').html(`<div>${currentBattle} 戦目の敵艦隊が挿入されました。</div><div>続ける場合は再度戦闘マスを選択してください。<div>`);
	$('#enemy_pattern_select').html('<li class="nav-item"><a class="nav-link ' + (mainColor === "#000000" ? '' : 'nav-link-dark') + ' active" data-toggle="tab" href="#">編成1</a></li>');
	$('#enemy_pattern_air_power').text('0');
	$('#enemy_display_mode_parent').addClass('d-none').removeClass('d-flex');
	$('.node_selected').removeClass('node_selected');
	$('#btn_continue_expand').prop('disabled', true);

	// なんらかの出撃基地があれば基地派遣設定ボタンを目立たせる
	$('#lb_tab_parent').find('.ohuda_select').each((i, e) => {
		if (castInt($(e).val()) === 2) {
			$('#btn_lb_target').removeClass('btn-outline-success');
			$('#btn_lb_target').addClass('btn-outline-danger');
			$('#lb_target_alert').removeClass('d-none');
		}
	});

	// 空襲編成入れてきた or 10戦目まで入力されたら閉じて終了
	if (isDefMode || currentBattle === 10) {
		$('#modal_enemy_pattern').modal('hide');
		if (currentBattle === 10) {
			inform_warning('敵艦との交戦回数が変更されました。基地航空隊の派遣先を確認してください。');
		}
	}
}

/**
 * 撃墜表マウスin
 * @param {JQuery} $this
 */
function shoot_down_table_tbody_MouseEnter($this) {
	const $tr = $this.closest('tr');
	const rowIndex = castInt($tr[0].dataset.shipindex);
	const css = $tr[0].dataset.css;
	$tr.addClass('bg-hover');
	$tr.find('.td_plane_name').addClass(css);
	$('#shoot_down_table_tbody').find('tr[data-shipindex="' + rowIndex + '"]:first').find('.td_name').addClass('bg-hover');
}

/**
 * 撃墜表マウスleave
 * @param {JQuery} $this
 */
function shoot_down_table_tbody_MouseLeave($this) {
	const $tr = $this.closest('tr');
	const rowIndex = castInt($tr[0].dataset.shipindex);
	const css = $tr[0].dataset.css;
	$tr.removeClass('bg-hover');
	$tr.find('.td_plane_name').removeClass(css);
	$('#shoot_down_table_tbody').find('tr[data-shipindex="' + rowIndex + '"]:first').find('.td_name').removeClass('bg-hover');
}

/**
 * グラフマウスin
 * @param {JQuery} $this
 */
function progress_area_MouseEnter($this) {
	const $bar = $this.find('.result_bar');
	const status = castInt($bar.data('airstatus'));
	const rowIndex = castInt($bar.attr('id').replace('result_bar_', ''));
	$bar.addClass('bar_ex_status' + status);
	$('#rate_row_' + rowIndex).addClass('bg_status' + status);
}

/**
 * グラフマウスleave
 * @param {JQuery} $this
 */
function progress_area_MouseLeave($this) {
	const $bar = $this.find('.result_bar');
	const status = castInt($bar.data('airstatus'));
	const rowIndex = castInt($bar.attr('id').replace('result_bar_', ''));
	$bar.removeClass('bar_ex_status' + status);
	$('#rate_row_' + rowIndex).removeClass('bg_status' + status);
}

/**
 * 確率テーブルマウスin
 * @param {JQuery} $this
 */
function rate_table_MouseEnter($this) {
	const rowIndex = castInt($this.closest('tr').attr('id').replace('rate_row_', ''));
	const $bar = $('#result_bar_' + rowIndex);
	const status = castInt($bar.data('airstatus'));
	$bar.addClass('bar_ex_status' + status);
	$('#rate_row_' + rowIndex).addClass('bg_status' + status);
}

/**
 * 確率テーブルマウスLeave
 * @param {JQuery} $this
 */
function rate_table_MouseLeave($this) {
	const rowIndex = castInt($this.closest('tr').attr('id').replace('rate_row_', ''));
	const $bar = $('#result_bar_' + rowIndex);
	const status = castInt($bar.data('airstatus'));
	$bar.removeClass('bar_ex_status' + status);
	$('#rate_row_' + rowIndex).removeClass('bg_status' + status);
}

/**
 * 敵撃墜表マウスin
 * @param {JQuery} $this
 */
function enemy_shoot_down_table_tbody_MouseEnter($this) {
	const $tr = $this.closest('tr');
	const rowIndex = castInt($tr[0].dataset.rowindex);
	const css = $tr[0].dataset.css;
	$tr.addClass('bg-hover');
	$tr.find('.td_plane_name').addClass(css);
	$('#enemy_shoot_down_tbody').find('.enemy_no_' + rowIndex + ':first').find('.td_name').addClass('bg-hover');
}

/**
 * 敵撃墜表マウスleave
 * @param {JQuery} $this
 */
function enemy_shoot_down_table_tbody_MouseLeave($this) {
	const $tr = $this.closest('tr');
	const rowIndex = castInt($tr[0].dataset.rowindex);
	const css = $tr[0].dataset.css;
	$tr.removeClass('bg-hover');
	$tr.find('.td_plane_name').removeClass(css);
	$('#enemy_shoot_down_tbody').find('.enemy_no_' + rowIndex + ':first').find('.td_name').removeClass('bg-hover');
}

/**
 * 表示戦闘タブ変更時
 * @param {JQuery} $this
 */
function display_battle_tab_Changed($this) {
	displayBattle = castInt($this.find('.nav-link').data('disp'));
	calculate();
}

/**
 * 結果表示欄表示物変更時
 */
function display_result_Changed() {
	if ($('#display_land_base_result').prop('checked')) {
		for (let i = 1; i < 7; i++) {
			$('#rate_row_' + i + ':not(.disabled_tr)').removeClass('d-none');
			$('#result_bar_' + i).closest('.progress_area:not(.disabled_bar)').removeClass('d-none').addClass('d-flex');
		}
	}
	else {
		for (let i = 1; i < 7; i++) {
			$('#rate_row_' + i).addClass('d-none');
			$('#result_bar_' + i).closest('.progress_area').addClass('d-none').removeClass('d-flex');
		}
	}

	if ($('#display_fleet_result').prop('checked')) {
		$('#rate_row_7:not(.disabled_tr)').removeClass('d-none');
		$('#result_bar_7').closest('.progress_area:not(.disabled_bar)').removeClass('d-none').addClass('d-flex');
	}
	else {
		$('#rate_row_7').addClass('d-none');
		$('#result_bar_7').closest('.progress_area').addClass('d-none').removeClass('d-flex');
	}

	if ($('#display_bar').prop('checked')) {
		$('#result_bar_parent').removeClass('d-none');
	}
	else {
		$('#result_bar_parent').addClass('d-none');
	}

	if ($('#display_enemy_table').prop('checked')) {
		$('#enemy_shoot_down_table_parent').removeClass('d-none');
	}
	else {
		$('#enemy_shoot_down_table_parent').addClass('d-none');
	}
}

/**
 * 基地計算結果詳細展開
 * @param {JQuery} $this
 */
function land_base_detail_Clicked($this) {
	// 詳細計算対象の取得
	landBaseDetailCalculate(castInt($this.data('base_no')), 0);
	$('#modal_result_detail').modal('show');
}

/**
 * 計算結果詳細展開
 * @param {JQuery} $this
 */
function fleet_slot_Clicked($this) {
	// 詳細計算対象の取得
	const shipId = castInt($this[0].dataset.shipid);
	const shipNo = castInt($this[0].dataset.shipindex);
	const slot = castInt($this[0].dataset.slotindex);
	if ($this.find('.td_plane_name').text() === '-' || $this.find('.td_plane_name').text() === '') return;

	fleetSlotDetailCalculate(shipNo, slot, shipId);
	$('#modal_result_detail').modal('show');
}

/**
 * 敵計算結果詳細展開
 * @param {JQuery} $this
 */
function enemy_slot_Clicked($this) {
	// 詳細計算対象の取得
	const enemyNo = castInt($this.closest('tr')[0].dataset.rowindex);
	const slot = castInt($this.closest('tr')[0].dataset.slotindex);
	enemySlotDetailCalculate(enemyNo, slot);
	$('#modal_result_detail').modal('show');
}

/**
 * 内部熟練度120計算機体カテゴリ変更時
 * @param {JQuery} $this
 */
function innerProfSetting_Clicked($this) {
	const clickedType = castInt($this.attr('id').replace('prof120_', ''));
	if ($this.prop('checked') && !initialProf120Plane.includes(clickedType)) {
		initialProf120Plane.push(clickedType);
	}
	else if (!$this.prop('checked') && initialProf120Plane.includes(clickedType)) {
		initialProf120Plane = initialProf120Plane.filter(v => v !== clickedType);
	}

	setting.initialProf120 = initialProf120Plane.sort((a, b) => a - b);
	saveSetting();

	calculate();
}

/**
 * シミュレート回数変更時
 * @param {JQuery} $this
 */
function calculate_count_Changed($this) {
	// 入力検証 -> 数値 かつ 0 以上 max 以下　違ってたら修正
	const value = validateInputNumber($this.val(), 100000);

	$this.val(value);
	setting.simulateCount = value;
	// ローカルストレージへ保存
	saveSetting();
}

/**
 * クリップボード保存チェック
 */
function clipboard_mode_Clicked() {
	// 未対応の場合強制 false
	if (typeof ClipboardItem !== "function") {
		$('#clipboard_mode').prop('checked', false);
		$('#cant_use_clipboard').removeClass('d-none');
	}

	setting.copyToClipboard = $('#clipboard_mode').prop('checked');
	saveSetting();
}

/**
 * よく使う装備削除クリック時
 */
function btn_reset_selected_plane_history_Clicked() {
	const $modal = $('#modal_confirm');
	$modal.find('.modal-body').html(`
		<div>よく使うとして登録された機体情報を削除します。</div>
		<div class="mt-3">よろしければ、OKボタンを押してください。</div>
	`);
	confirmType = "deleteSelectedPlaneHistory";
	$modal.modal('show');
}

/**
 * よく使う艦娘削除クリック時
 */
function btn_reset_selected_ship_history_Clicked() {
	const $modal = $('#modal_confirm');
	$modal.find('.modal-body').html(`
		<div>よく使うとして登録された艦娘情報を削除します。</div>
		<div class="mt-3">よろしければ、OKボタンを押してください。</div>
	`);
	confirmType = "deleteSelectedShipHistory";
	$modal.modal('show');
}

/**
 * 所持テーブルカテゴリ変更時
 */
function stock_type_select_Changed() {
	const displayType = Math.abs(castInt($('#stock_type_select').val()));
	let searchWord = $('#stock_word').val().trim();
	if (searchWord) {
		searchWord = replaceKnji(searchWord);
	}

	$('#plane_stock').find('.stock_tr').each((i, e) => {
		// カテゴリになければ非表示
		if (displayType > 0 && !$(e).hasClass('type_' + displayType)) {
			$(e).addClass('d-none').removeClass('d-flex');
		}
		// 名前がなければ非表示
		else if (searchWord && !$(e).find('.stock_td_name').text().includes(searchWord)) {
			$(e).addClass('d-none').removeClass('d-flex');
		}
		else {
			$(e).addClass('d-flex').removeClass('d-none');
		}
	});
}

/**
 * 所持テーブルカテゴリ変更時
 */
function ship_stock_type_select_Changed() {
	const displayType = castInt($('#ship_stock_type_select').val());
	let searchWord = $('#ship_stock_word').val().trim();
	if (searchWord) {
		searchWord = replaceKnji(searchWord);
	}

	$('#ship_stock').find('.stock_tr').each((i, e) => {
		// カテゴリになければ非表示
		if (displayType > 0 && !$(e).hasClass('type_' + displayType)) {
			$(e).addClass('d-none').removeClass('d-flex');
		}
		// 名前がなければ非表示
		else if (searchWord && !$(e).find('.stock_td_name').text().includes(searchWord)) {
			$(e).addClass('d-none').removeClass('d-flex');
		}
		else {
			$(e).addClass('d-flex').removeClass('d-none');
		}
	});
}

/**
 * 所持装備情報読み込みクリック
 */
function btn_load_equipment_json_Clicked() {
	const inputData = $('#input_equipment_json').val().trim();

	if (readEquipmentJson(inputData)) {
		setPlaneStockTable();
		$('#input_equipment_json').val('');
		$('#input_equipment_json').removeClass('is-invalid').addClass('is-valid');
		inform_success('所持装備情報を更新しました。');
	}
	else {
		$('#input_equipment_json').addClass('is-invalid').removeClass('is-valid');
		inform_danger('装備情報の読み込みに失敗しました。入力されたデータ形式が正しくない可能性があります。');
	}
}

/**
 * 所持装備情報読み込みクリック
 */
function btn_load_ship_json_Clicked() {
	const inputData = $('#input_ship_json').val().trim();

	if (readShipJson(inputData)) {
		setShipStockTable();
		$('#input_ship_json').val('');
		$('#input_ship_json').removeClass('is-invalid').addClass('is-valid');
		inform_success('所持艦娘情報を更新しました。');
	}
	else {
		$('#input_ship_json').addClass('is-invalid').removeClass('is-valid');
		inform_danger('艦娘情報の読み込みに失敗しました。入力されたデータ形式が正しくない可能性があります。');
	}
}

/**
 * 装備情報テキスト変更時
 * @param {*} $this
 */
function input_equipment_json_Changed($this) {
	// 入力検証　0文字はアウト
	const input = $this.val().trim();
	const $btn = $('#btn_load_equipment_json');
	if (input.length === 0) {
		$this.addClass('is-invalid').removeClass('is-valid');
		$this.nextAll('.invalid-feedback').text('データが入力されていません。');
		$btn.prop('disabled', true);
	}
	else {
		$this.removeClass('is-invalid');
		$btn.prop('disabled', false);
	}
}

/**
 * 艦娘情報テキスト変更時
 * @param {*} $this
 */
function input_ship_json_Changed($this) {
	// 入力検証　0文字はアウト
	const input = $this.val().trim();
	const $btn = $('#btn_load_ship_json');
	if (input.length === 0) {
		$this.addClass('is-invalid').removeClass('is-valid');
		$this.nextAll('.invalid-feedback').text('データが入力されていません。');
		$btn.prop('disabled', true);
	}
	else {
		$this.removeClass('is-invalid');
		$btn.prop('disabled', false);
	}
}

/**
 * 装備お気に入り全リセット
 */
function btn_fav_clear_Clicked() {
	const $modal = $('#modal_confirm');
	$modal.find('.modal-body').html(`
		<div>お気に入り機体情報をリセットします。</div>
		<div class="mt-3">よろしければ、OKボタンを押してください。</div>
	`);
	confirmType = "resetFavoritePlane";
	$modal.modal('show');
}

/**
 * 艦娘お気に入り全リセット
 */
function btn_fav_ship_clear_Clicked() {
	const $modal = $('#modal_confirm');
	$modal.find('.modal-body').html(`
		<div>お気に入り艦娘情報をリセットします。</div>
		<div class="mt-3">よろしければ、OKボタンを押してください。</div>
	`);
	confirmType = "resetFavoriteShip";
	$modal.modal('show');
}

/**
 * 所持装備数全リセット
 */
function btn_stock_all_clear_Clicked() {
	const $modal = $('#modal_confirm');
	$modal.find('.modal-body').html(`
		<div>所持機体情報をリセットします。</div>
		<div class="mt-3">現在保存されている所持装備情報が削除され、全ての機体の所持数が0となります。</div>
		<div class="mt-3">よろしければ、OKボタンを押してください。</div>
	`);
	confirmType = "resetPlaneStock";
	$modal.modal('show');
}

/**
 * 所持艦娘数全リセット
 */
function btn_ship_stock_all_clear_Clicked() {
	const $modal = $('#modal_confirm');
	$modal.find('.modal-body').html(`
		<div>所持艦娘情報をリセットします。</div>
		<div class="mt-3">現在保存されている所持艦娘情報が削除され、全ての艦娘の所持数が0となります。</div>
		<div class="mt-3">よろしければ、OKボタンを押してください。</div>
	`);
	confirmType = "resetShipStock";
	$modal.modal('show');
}


/**
 * 検索語句が変更された(所持機体)
 */
function stock_word_TextChanged() {
	if (timer !== false) clearTimeout(timer);
	timer = setTimeout(function () { stock_type_select_Changed() }, 250);
}

/**
 * 検索語句が変更された(所持艦娘)
 */
function ship_stock_word_TextChanged() {
	if (timer !== false) clearTimeout(timer);
	timer = setTimeout(function () { ship_stock_type_select_Changed() }, 250);
}


/**
 * お気に入りクリック 艦載機
 * @param {JQuery} $this
 */
function stock_td_fav_Clicked($this) {

	const targetPlaneId = castInt($this.closest('.stock_tr').data('planeid'));
	if ($this.hasClass('stock_fav')) {
		// お気に入り解除
		setting.favoritePlane = setting.favoritePlane.filter(v => v !== targetPlaneId);
		$this.addClass('stock_unfav unfav_clicked').removeClass('stock_fav');
		setTimeout(() => { $this.removeClass('unfav_clicked'); }, 500);
	}
	else {
		// お気に入り登録
		setting.favoritePlane.push(targetPlaneId);
		$this.addClass('stock_fav fav_clicked').removeClass('stock_unfav');
		setTimeout(() => { $this.removeClass('fav_clicked'); }, 500);
	}

	saveSetting();
}

/**
 * お気に入りクリック 艦娘
 * @param {JQuery} $this
 */
function ship_stock_td_fav_Clicked($this) {

	const shipId = castInt($this.parent()[0].dataset.shipid);
	if ($this.hasClass('stock_fav')) {
		// お気に入り解除
		setting.favoriteShip = setting.favoriteShip.filter(v => v !== shipId);
		$this.addClass('stock_unfav unfav_clicked').removeClass('stock_fav');
		setTimeout(() => { $this.removeClass('unfav_clicked'); }, 500);
	}
	else {
		// お気に入り登録
		setting.favoriteShip.push(shipId);
		$this.addClass('stock_fav fav_clicked').removeClass('stock_unfav');
		setTimeout(() => { $this.removeClass('fav_clicked'); }, 500);
	}

	saveSetting();
}

/**
 * 所持機体名クリック
 * @param {JQuery} $this
 */
function stock_tr_Clicked($this) {
	const $modal = $('#modal_plane_stock');
	const $tr = $modal.find('.plane_status_tr');
	const plane = PLANE_DATA.find(v => v.id === castInt($this.data('planeid')));
	const planeStock = loadPlaneStock();
	const stockData = planeStock.find(v => v.id === plane.id);

	$modal.find('.stock_num').each((i, e) => {
		$(e).val(stockData.num[i]);
		if (i > 0) $(e).prop('disabled', !plane.canRemodel);
	});
	$tr.find('.plane_status_anti_air').text(plane.antiAir);
	$tr.find('.plane_status_torpedo').text(plane.torpedo);
	$tr.find('.plane_status_bomber').text(plane.bomber);
	$tr.find('.plane_status_radius').text(plane.radius);
	$tr.find('.plane_status_interception').text(plane.interception);
	$tr.find('.plane_status_anti_bomber').text(plane.antiBomber);

	const $avoid = $tr.find('.plane_status_avoid');
	const avoid = AVOID_TYPE.find(v => v.id === plane.avoid);
	if (avoid) {
		$avoid.text(avoid.name);
		$avoid.attr('title', '割合撃墜補正：' + avoid.adj[0] + ', 固定撃墜補正：' + avoid.adj[1]);
	}
	else {
		$avoid.text('なし');
		$avoid.attr('title', '割合撃墜補正：1.0, 固定撃墜補正：1.0');
	}

	$modal.find('#edit_id').text(plane.id);
	$modal.find('.plane_status_name').text(plane.name);
	$modal.find('#stock_sum').val(getArraySum(stockData.num));
	$modal.find('.img_plane_card').attr('src', '../img/plane/' + plane.id + '.png');
	$modal.modal('show');
}

/**
 * 所持数変更時
 * @param {JQuery} $this
 */
function stock_Changed($this) {
	let inputValue = castInt($this.val());
	// 全体総数
	let sum = 0;
	$('.stock_num').each((i, e) => {
		sum += castInt($(e).val());
	});
	// 99超えたら補正
	if (sum > 99) {
		inputValue -= (sum - 99);
		sum = 99;
	}

	$this.val(validateInputNumber(inputValue, 99));
	$('#stock_sum').val(sum);
}

/**
 * 所持機体数保存クリック
 */
function btn_save_stock_Clicked() {
	const planeStock = loadPlaneStock();
	const planeId = castInt($('#edit_id').text());

	const numArray = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
	$('.stock_num').each((i, e) => {
		numArray[i] = castInt($(e).val());
	});

	planeStock.find(v => v.id === planeId).num = numArray;
	saveLocalStorage('planeStock', planeStock);
	inform_success('所持数を更新しました。');

	$('#modal_plane_stock').modal('hide');
	setPlaneStockTable();
}

/**
 * 所持数リセットボタンクリック
 */
function btn_stock_reset_Clicked() {
	$('#modal_plane_stock').find('.stock_num').val('0');
	$('#modal_plane_stock').find('#stock_sum').val('0');
}

/**
 * 艦娘所持数変更時
 * @param {JQuery} $this
 */
function stock_td_stock_Changed($this) {
	const input = validateInputNumber(castInt($this.val()), 99);
	$this.val(input);

	const id = castInt($this.parent()[0].dataset.shipid);
	// 所持数更新
	const shipStock = loadShipStock();
	shipStock.find(v => v.id === id).num = input;
	saveLocalStorage('shipStock', shipStock);
	inform_success('艦娘保有数を更新しました。');
}

/**
 * 仮想敵艦展開時
 */
function manage_manual_enemu_content_Shown() {
	if (!document.getElementById('created_manual_enemies').innerHTML.trim()) {
		drawManualEnemies();
	}
}

/**
 * 手動敵艦展開
 */
function drawManualEnemies() {
	const table = document.getElementById('created_manual_enemies');
	table.innerHTML = '';

	for (const i of UNKNOWN_ENEMY) {
		const enemy = new Enemy(i);

		const tr = document.createElement('div');
		tr.className = 'manual_enemy_tr general_tr d-flex px-3 py-2';
		tr.dataset.virtualid = enemy.id;

		// 画像 id　ラッパー
		const td_head = document.createElement('div');
		td_head.className = 'd-flex manual_enemy_head';
		// 画像
		const td_img = document.createElement('img');
		td_img.className = 'enemy_name_img d-none d-md-block';
		td_img.src = '../img/enemy/' + enemy.id + '.png';
		td_head.appendChild(td_img);
		// ID 名称 ラッパー
		const id_name_td = document.createElement('div');
		id_name_td.className = 'ml-1 manual_enemy_name_td';
		// ID
		const id_td = document.createElement('div');
		id_td.className = 'text-primary font_size_11';
		id_td.textContent = 'ID : ' + (enemy.id + 1500);
		const td_name = document.createElement('div');
		td_name.textContent = enemy.name;

		id_name_td.appendChild(id_td);
		id_name_td.appendChild(td_name);
		td_head.appendChild(id_name_td);
		tr.appendChild(td_head);

		const slots = document.createElement('div');
		slots.className = 'manual_enemy_slots';

		for (let j = 0; j < enemy.equipments.length; j++) {
			const item = enemy.equipments[j];
			const slot = enemy.rawSlots[j];

			if (item.id <= 0) continue;

			const slotDiv = document.createElement('div');
			slotDiv.className = 'manual_enemy_slot d-flex';

			const slotCount = document.createElement('div');
			slotCount.className = 'mr-2 d-none d-md-inline manual_enemy_slot_count';
			slotCount.textContent = slot < 0 ? 0 : slot;

			const img = document.createElement('img');
			img.className = 'img-size-25';
			img.src = '../img/plane/' + item.id + '.png';

			const planeName = document.createElement('div');
			planeName.className = 'ml-1'
			planeName.textContent = item.name;

			slotDiv.appendChild(slotCount);
			slotDiv.appendChild(img);
			slotDiv.appendChild(planeName);
			slots.appendChild(slotDiv);
		}
		tr.appendChild(slots);


		const td_ap = document.createElement('div');
		td_ap.className = 'manual_enemy_ap_td';
		td_ap.textContent = (enemy.airPower === 0 && enemy.landBaseAirPower ? `(${enemy.landBaseAirPower})` : enemy.airPower);
		tr.appendChild(td_ap);

		const td_aaw = document.createElement('div');
		td_aaw.className = 'manual_enemy_aaw_td';
		td_aaw.textContent = enemy.antiAirWeight;
		tr.appendChild(td_aaw);

		const td_aabo = document.createElement('div');
		td_aabo.className = 'manual_enemy_aabo_td';
		td_aabo.textContent = enemy.antiAirBonus;
		tr.appendChild(td_aabo);

		table.appendChild(tr);
	}
}

/**
 * 仮想敵艦展開
 * @param {JQuery} $this
 */
function manul_enemy_Clicked($this) {
	for (let i = 0; i < 4; i++) {
		document.getElementsByClassName('enemy_slot')[i].value = -1;
		document.getElementsByClassName('enemy_slot')[i].value = 0;
	}

	const enemy = ENEMY_DATA.find(v => v.id === castInt($this[0].dataset.virtualid));
	if (enemy) {
		document.getElementById('manual_enemy_img').src = `../img/enemy/${enemy.id}.png`;
		document.getElementById('manual_enemy_id').textContent = enemy.id;
		document.getElementById('manual_enemy_name').textContent = enemy.name;
		setEnemyPlaneCombobox(enemy);

		for (let i = 0; i < enemy.slot.length; i++) {
			if (i >= 4) {
				break;
			}
			document.getElementsByClassName('enemy_slot')[i].value = enemy.slot[i] < 0 ? 0 : enemy.slot[i];
			document.getElementsByClassName('enemy_planes')[i].value = enemy.eqp[i] < 0 ? 0 : enemy.eqp[i];
		}
		document.getElementById('manual_aa').value = enemy.aa;
	}
	else {
		inform_warning('エラーが発生しました。');
		return;
	}

	calculateVirtualEnemy();
	$('#modal_manual_enemy').modal('show');
}

/**
 * 対空砲火シミュ内搭載数変更
 * @param {JQuery} $this
 */
function manual_enemy_input_Changed($this) {
	// 入力検証 -> 数値 かつ 0 以上 max 以下　違ってたら修正
	const value = validateInputNumber($this.val(), castInt($this.attr('max')));
	$this.val(value);

	calculateVirtualEnemy();
}

/**
 * 仮想敵艦艦種変更時
 * @param {Object} enemy 敵艦
 */
function setEnemyPlaneCombobox(enemy) {
	let optgroup = null;
	let prevType = -1;
	const parent = document.createElement('div');
	parent.innerHTML = '';

	const noneOp = document.createElement('option');
	noneOp.textContent = `-`;
	noneOp.value = -1;
	parent.appendChild(noneOp);

	let enemyPlanes = null;
	if (isContain(enemy.type, [11, 12, 20, 21, 2])) {
		enemyPlanes = ENEMY_PLANE_DATA.filter(v => v.type !== 5);
	}
	else {
		enemyPlanes = ENEMY_PLANE_DATA.filter(v => true);
	}

	// 機体マスタ読込
	for (const plane of enemyPlanes) {
		const type = Math.abs(plane.type);
		if (prevType !== type) {
			if (optgroup !== null) {
				parent.appendChild(optgroup);
			}

			prevType = type;
			optgroup = document.createElement('optgroup');

			let typeObj = PLANE_TYPE.find(v => v.id === type);
			if (typeObj) {
				optgroup.label = typeObj.name;
			}
			else {
				typeObj = OTHER_TYPE.find(v => v.id === type);
				optgroup.label = typeObj ? typeObj.name : "未定義";
			}
		}

		const option = document.createElement('option');
		option.textContent = `${plane.id}: ${plane.name}`;
		option.value = plane.id;

		optgroup.appendChild(option);
	}
	parent.appendChild(optgroup);

	for (const elem of document.getElementsByClassName('enemy_planes')) {
		elem.innerHTML = parent.innerHTML;
		elem.options[0].selected = true;
	}
}

/**
 * 仮想敵艦制空値計算
 */
function calculateVirtualEnemy() {
	let sumAp = 0;
	for (let i = 0; i < 4; i++) {
		const slots = castInt(document.getElementsByClassName('enemy_slot')[i].value);
		const planeId = castInt(document.getElementsByClassName('enemy_planes')[i].value);
		const apLabel = document.getElementsByClassName('manual_enemy_ap')[i];

		if (planeId < 500 || slots <= 0) {
			apLabel.textContent = 0;
			continue;
		}
		const plane = ENEMY_PLANE_DATA.find(v => v.id === planeId);
		if (!plane) {
			apLabel.textContent = 0;
			document.getElementsByClassName('enemy_planes')[i].options[0].selected = true;
			continue;
		}

		const ap = plane.type < 1000 ? Math.floor(plane.antiAir * Math.sqrt(slots)) : 0;
		apLabel.textContent = ap;
		sumAp += ap;
	}
	document.getElementById('manual_enemy_sumAP').textContent = sumAp;
}

/**
 * 敵艦手動更新
 */
function commit_enemy_Clicked() {
	const enemyId = castInt(document.getElementById('manual_enemy_id').textContent);

	if (UNKNOWN_ENEMY.includes(enemyId)) {
		const old = ENEMY_DATA.find(v => v.id === enemyId);
		const enemy = { id: enemyId, type: old.type, name: old.name, slot: [], eqp: [], orig: old.orig, aa: 0 }

		enemy.aa = castInt(document.getElementById('manual_aa').value);

		const parent = document.getElementById('enemy_slot_info');
		for (let i = 0; i < 4; i++) {
			const slot = castInt(parent.getElementsByClassName('enemy_slot')[i].value);
			const planeId = castInt(parent.getElementsByClassName('enemy_planes')[i].value);

			// 装備かチェック
			const item = ENEMY_PLANE_DATA.find(v => v.id === planeId);
			if (item) {
				// 装備と搭載数を格納 機体じゃないなら搭載数は0
				enemy.slot.push(item.type < 1000 ? slot : 0);
				enemy.eqp.push(item.id);
			}
			else {
				// 不正な値
				enemy.slot.push(-1);
				enemy.eqp.push(-1);
			}
		}

		let manualEnemies = loadLocalStorage('manual_enemies');
		if (!manualEnemies) {
			manualEnemies = [];
		}

		const index = manualEnemies.findIndex(v => v.id === enemy.id);
		if (index < 0) {
			manualEnemies.push(enemy);
		}
		else {
			manualEnemies[index] = enemy;
		}

		const enemyIndex = ENEMY_DATA.findIndex(v => v.id === enemy.id);
		ENEMY_DATA[enemyIndex] = enemy;
		saveLocalStorage('manual_enemies', manualEnemies);

		drawManualEnemies();
		inform_success('敵艦情報が更新されました。');
		calculate();
		$('#modal_manual_enemy').modal('hide');
	}
}

/**
 * サーバー値に戻す
 */
function rollback_enemy_Clicked() {
	let manualEnemies = loadLocalStorage('manual_enemies');
	const enemyId = castInt(document.getElementById('manual_enemy_id').textContent);
	if (manualEnemies) {
		manualEnemies = manualEnemies.filter(v => v.id !== enemyId);
		saveLocalStorage('manual_enemies', manualEnemies);
		location.reload();
	}
}

/**
 * 表示戦闘タブ変更時
 * @param {JQuery} $this
 */
function btn_target_Clicked($this) {
	const value = castInt($this[0].dataset.target) - 1;
	$this.parent().find('input[type="hidden"]').val(value);
}

/**
 * 詳細画面　再計算クリック
 */
function btn_calculate_detail() {
	// 計算回数の変更
	const originalCount = $('#calculate_count').val();
	$('#calculate_count').val($('#detail_calculate_count').val());

	detailCalculate();

	$('#btn_calculate_detail').prop('disabled', true);
	$('#calculate_count').val(originalCount);
}

/**
 * 表示戦闘タブ変更時
 * @param {JQuery} $this
 */
function detail_slot_tab_Changed($this) {
	if ($this.find('.nav-link').hasClass('disabled')) return;
	$('#detail_info').data('slot_no', castInt($this.data('slot_no')));
	detailCalculate();
}

/**
 * グラフ表示機体切り替え
 * @param {JQuery} $this
 */
function btn_show_detail_Clicked($this) {
	$('#detail_info').data('slot_no', castInt($this[0].dataset.slot_no));
	detailCalculate();
}


/**
 * 搭載数分布をクリップボードに出力 JSON
 */
function btn_output_slot_dist_Clicked() {
	try {
		const labels = chartInstance.data.labels;
		const rates = chartInstance.data.datasets[0].data;

		// 表示するスロットの最大値 基本は取りうる値の最大値から。
		let maxSlot = getArrayMax(labels.map(v => castInt(v)));
		const detailMode = $('#detail_info').data('mode');
		if (detailMode === 'land_base_detail') {
			// 基地は18機から表示
			maxSlot = 18;
		}
		else if ($('#slot_detail').prop('checked')) {
			// 基地以外はマスタから最大搭載数を取得
			const $id = $('#detail_legend').find('.legend_name');
			const slotNo = castInt($('#detail_info').data('slot_no'));
			if (detailMode === 'enemy_slot_detail') {
				const enemy = ENEMY_DATA.find(v => v.id === castInt($id.data('enemyid')));
				if (enemy) maxSlot = enemy.slot[slotNo];
			}
			else if (detailMode === 'fleet_slot_detail') {
				const ship = SHIP_DATA.find(v => v.id === castInt($id.data('shipid')));
				if (ship) maxSlot = ship.slot[slotNo];
			}
		}

		const output = [];
		if (labels.length > 0) {
			for (let i = maxSlot; i >= 0; i--) {
				const index = labels.indexOf(i);
				if (index > -1) {
					output.push({ slot: i, rate: rates[index] / 100 });
				}
				else {
					output.push({ slot: i, rate: 0 });
				}
			}
		}

		$('#dist_text').removeClass('d-none');
		$('#dist_text').val(JSON.stringify(output));
		copyInputTextToClipboard($('#dist_text'));
		$('#dist_text').addClass('d-none');
	} catch (error) {
		inform_danger('出力に失敗しました。');
	}
}
/**
 * 搭載数分布をクリップボードに出力 表計算ソフト系
 */
function btn_output_slot_dist_table_Clicked() {
	try {
		const labels = chartInstance.data.labels;
		const rates = chartInstance.data.datasets[0].data;

		// 表示するスロットの最大値 基本は取りうる値の最大値から。
		let maxSlot = getArrayMax(labels.map(v => castInt(v)));
		const detailMode = $('#detail_info').data('mode');
		if (detailMode === 'land_base_detail') {
			// 基地は18機から表示
			maxSlot = 18;
		}
		else if ($('#slot_detail').prop('checked')) {
			// 基地以外はマスタから最大搭載数を取得
			const $id = $('#detail_legend').find('.legend_name');
			const slotNo = castInt($('#detail_info').data('slot_no'));
			if (detailMode === 'enemy_slot_detail') {
				const enemy = ENEMY_DATA.find(v => v.id === castInt($id.data('enemyid')));
				if (enemy) maxSlot = enemy.slot[slotNo];
			}
			else if (detailMode === 'fleet_slot_detail') {
				const ship = SHIP_DATA.find(v => v.id === castInt($id.data('shipid')));
				if (ship) maxSlot = ship.slot[slotNo];
			}
		}

		let text = '';
		if (labels.length > 0) {
			for (let i = maxSlot; i >= 0; i--) {
				const index = labels.indexOf(i);
				if (i !== maxSlot) text += '\r\n';

				if (index > -1) text += `${i}\t${rates[index] / 100}`;
				else text += `${i}\t0`;
			}
		}

		$('#dist_text').removeClass('d-none');
		$('#dist_text').val(text);
		copyInputTextToClipboard($('#dist_text'));
		$('#dist_text').addClass('d-none');
	} catch (error) {
		inform_danger('出力に失敗しました。');
	}
}

/**
 * 確認ダイアログOKボタンクリック時
 */
function modal_confirm_ok_Clicked() {
	switch (confirmType) {
		case "deleteLocalStorageAll":
			window.localStorage.clear();
			break;
		case "resetPlaneStock":
			deleteLocalStorage('planeStock');
			setPlaneStockTable();
			break;
		case "resetShipStock":
			deleteLocalStorage('shipStock');
			setShipStockTable();
			break;
		case "resetFavoritePlane":
			setting.favoritePlane = [];
			setting.favoriteOnly = false;
			$('#fav_only').prop('checked', false);
			saveSetting();
			setPlaneStockTable();
			break;
		case "resetFavoriteShip":
			setting.favoriteShip = [];
			setting.favoriteOnlyShip = false;
			$('#fav_only_ship').prop('checked', false);
			saveSetting();
			setShipStockTable();
			break;
		case "deleteSelectedPlaneHistory":
			setting.selectedHistory[0] = [];
			saveSetting();
			break;
		case "deleteSelectedShipHistory":
			setting.selectedHistory[1] = [];
			saveSetting();
			break;
		case "Error":
			break;
		default:
			break;
	}
	$('#modal_confirm').modal('hide');
}

/**
 * メニュー「編成保存」ボタンクリック
 */
function btn_save_preset_Clicked() {
	// アップロード非チェック
	$('#allow_upload_preset').prop('checked', false);
	$('#upload_option').addClass('d-none');
	$('#btn_upload_preset').addClass('d-none');

	// 現在のアクティブタブの情報を取得
	const presets = loadLocalStorage('presets');
	if (presets) {
		const preset = presets.find(v => v[0] === getActivePreset().id);

		if (preset) {
			// ローカルストレージにすでに保存済みの編成だったら
			document.getElementById('input_preset_name').value = preset[1];
			document.getElementById('preset_remarks').value = preset[3];

			// 編成の更新を行って終わり
			updateMainPreset();
			inform_success('編成の上書き更新が完了しました。');
			return;
		}
		else {
			// ローカルストレージに存在しない編成だったら
			document.getElementById('input_preset_name').value = '';
			document.getElementById('preset_remarks').value = '';
		}
	}
	else {
		// ローカルストレージ編成がそもそも存在しなかったら
		document.getElementById('input_preset_name').value = '';
		document.getElementById('preset_remarks').value = '';
	}

	$('#modal_main_preset').find('.btn_commit_preset').prop('disabled', true);
	$('#modal_main_preset').modal('show');
}

/**
 * 別名で保存ボタンクリック
 */
function btn_save_preset_sub_Clicked() {
	// アップロード非チェック
	$('#allow_upload_preset').prop('checked', false);
	$('#upload_option').addClass('d-none');
	$('#btn_upload_preset').addClass('d-none');

	// 現在のアクティブタブの情報を取得
	const presets = loadLocalStorage('presets');
	if (presets) {
		const preset = presets.find(v => v[0] === getActivePreset().id);
		if (preset) {
			// ローカルストレージにすでに保存済みの編成だったら
			document.getElementById('input_preset_name').value = preset[1];
			document.getElementById('preset_remarks').value = preset[3];

			// 新しい名前で保存しようとする　-> 別名保存ボタンにする
			const $btn = $('#modal_main_preset').find('.btn_commit_preset');
			$btn.text('別名で保存');
			$btn.addClass('rename');
			$btn.prop('disabled', true);
			$('#modal_main_preset').modal('show');

			return;
		}
	}

	// 上記以外の場合は編成上書きクリック時と同じ挙動させる
	btn_save_preset_Clicked();
}

/**
 * メニュー「おまかせ」ボタンクリック
 */
function btn_auto_expand_Clicked() {
	$('#alert_auto_expand').addClass('d-none');
	$('#modal_auto_expand').modal('show');
}

/**
 * メニュー「Twitter」ボタンクリック
 */
async function btn_twitter_Clicked() {
	const url = 'https://noro6.github.io/kcTools/?d=' + encodePreset();
	let shortURL = url;
	await postURLData(url)
		.then(json => {
			if (json.error || !json.shortLink) console.log(json);
			else shortURL = json.shortLink;
		})
		.catch(error => console.error(error));
	window.open('https://twitter.com/share?url=' + shortURL);
}

/**
 * 元に戻すボタンクリック
 */
function btn_undo_Clicked() {
	const preset = getActivePreset();
	const history = preset.history;
	const nowIndex = history.index + 1;
	if (nowIndex >= history.histories.length || document.getElementById('btn_undo').classList.contains('disabled')) return;
	const tmp = history.histories.concat();

	expandMainPreset(decodePreset(history.histories[nowIndex]));
	calculate();

	history.index = nowIndex;
	history.histories = tmp;

	updateActivePreset(preset);

	// 次回できなさそうなら無効化
	if (nowIndex + 1 === history.histories.length) {
		document.getElementById('btn_undo').classList.add('disabled');
	}

	document.getElementById('btn_redo').classList.remove('disabled');
}

/**
 * やりなおすボタンクリック
 */
function btn_redo_Clicked() {
	const preset = getActivePreset();
	const history = preset.history;
	const nowIndex = history.index - 1;
	if (nowIndex < 0 || document.getElementById('btn_redo').classList.contains('disabled')) return;
	const tmp = history.histories.concat();

	expandMainPreset(decodePreset(history.histories[history.index - 1]));
	calculate();

	history.index = nowIndex;
	history.histories = tmp;

	updateActivePreset(preset);

	// 次回できなさそうなら無効化
	if (nowIndex - 1 < 0) {
		document.getElementById('btn_redo').classList.add('disabled');
	}
	else {
		document.getElementById('btn_redo').classList.remove('disabled');
	}
}

/**
 * URL短縮ボタンクリック
 */
async function btn_url_shorten_Clicked() {
	const button = document.getElementById('btn_url_shorten');
	const textbox = document.getElementById('input_url');
	const url = textbox.value.trim();

	if (button.classList.contains('shortening')) return;
	button.classList.add('shortening');
	button.textContent = '短縮中';

	// urlチェック
	if (!url) {
		textbox.value = "";
		inform_warning('URLを入力してください。');
	}
	else if (!url.match(/^(https?|ftp)(:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#]+)$/)) {
		textbox.value = "";

		// 隠し機能
		// デッキビルダー形式チェック
		const preset = readDeckBuilder(url);
		if (preset) {
			expandMainPreset(preset, preset[0][0].length > 0, true, false);
			calculate();
			inform_success('編成の反映に成功しました。');
		}
		// 所持装備チェック
		else if (readEquipmentJson(url)) {
			setPlaneStockTable();
			inform_success('所持装備の反映に成功しました。');
		}
		else if (readShipJson(url)) {
			setShipStockTable();
			inform_success('所持艦娘の反映に成功しました。');
		}
		else {
			inform_danger('入力されたURLの短縮に失敗しました。');
		}
	}
	else if (!url.match(/^(https:\/\/aircalc.page.link\/)([.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#]+)$/)) {
		await postURLData(url)
			.then(json => {
				if (json.error || !json.shortLink) {
					textbox.value = "";
					inform_danger('入力されたURLの短縮に失敗しました。');
				}
				else {
					textbox.value = json.shortLink;
					inform_success('URLの短縮に成功しました。');
				}
			})
			.catch(error => {
				textbox.value = "";
				inform_danger('入力されたURLの短縮に失敗しました。');
			});
	}

	button.textContent = 'URL短縮';
	button.classList.remove('shortening');
}

/**
 * プリセットメモ変更時
 * @param {JQuery} $this
 */
function preset_remarks_Changed($this) {
	// 入力検証　全半400文字くらいで
	const input = $this.val().trim();
	if (input.length > 400) {
		$this.addClass('is-invalid');
	}
	else {
		$this.removeClass('is-invalid');
		$this.addClass('is-valid');
	}
}

/**
 * 編成取り込みデータテキスト変更時
 * @param {JQuery} $this
 */
function input_deck_Changed($this) {
	// 入力検証　0文字はアウト
	const input = $this.val().trim();
	const $btn = $this.closest('.modal-body').find('.btn_load_deck');
	if (input.length === 0) {
		$this.addClass('is-invalid').removeClass('is-valid');
		$this.nextAll('.invalid-feedback').text('データが入力されていません。');
		$btn.prop('disabled', true);
	}
	else {
		$this.removeClass('is-invalid');
		$btn.prop('disabled', false);
	}
}

/**
 * 共有データ文字列欄クリック時
 * @param {JQuery} $this
 */
function output_data_Clicked($this) {
	if (!$this.hasClass('is-valid')) return;
	if (copyInputTextToClipboard($this)) {
		inform_success('クリップボードにコピーしました。')
	}
}

/**
 * 共有データテキスト変更時
 * @param {JQuery} $this
 */
function output_data_Changed($this) {
	$this.removeClass('is-valid');
}

/**
 * 編成プリセット保存ボタンクリック
 */
function btn_commit_main_preset_Clicked() {

	const user = $('#upload_user').val().trim();
	const name = document.getElementById('input_preset_name').value.trim();
	if ($('#allow_upload_preset').prop('checked') && user.length > 20) {
		inform_warning('投稿者名は20文字以内で入力してください。');
		return;
	}
	if ($('#allow_upload_preset').prop('checked') && !name) {
		inform_warning('編成名を入力してください。');
		return;
	}

	// 新規登録 or 更新処理
	updateMainPreset();
}

/**
 * プリセアップロード海域選択時
 */
function select_preset_category_Changed() {
	const area = castInt($('#select_preset_category').val());

	if (area > 400) {
		$('#select_preset_level').parent().removeClass('d-none');
		$('#select_preset_level').val(4);
	}
	else {
		$('#select_preset_level').parent().addClass('d-none');
	}
}

/**
 * アップロードする場合クリック
 */
function allow_upload_preset_Clicked() {
	if ($('#allow_upload_preset').prop('checked')) {
		$('#upload_option').removeClass('d-none');

		// アップロードのみボタン出現
		if ($('#modal_main_preset').find('.btn_commit_preset').hasClass('rename')) {
			$('#btn_upload_preset').removeClass('d-none');
		}
		else {
			$('#btn_upload_preset').addClass('d-none');
		}

		$('#upload_user').val(setting.uploadUserName);
	}
	else {
		$('#upload_option').addClass('d-none');
		$('#btn_upload_preset').addClass('d-none');
	}
}

/**
 * アップロードのみボタンクリック
 */
function btn_upload_preset_Clicked() {
	const user = $('#upload_user').val().trim();
	const name = document.getElementById('input_preset_name').value.trim();
	if (user.length > 20) {
		inform_warning('投稿者名は20文字以内で入力してください。');
		return;
	}
	if (!name) {
		inform_warning('編成名を入力してください。');
		return;
	}
	updateMainPreset(true);
}

/**
 * デッキビルダーデータ読み込みクリック
 */
function btn_load_deck_Clicked() {
	const inputData = $('#input_deck').val().trim();
	const preset = readDeckBuilder(inputData);

	if (preset) {
		expandMainPreset(preset, preset[0][0].length > 0, true, false);
		$('#input_deck').removeClass('is-invalid').addClass('is-valid');
		inform_success('編成の読み込みに成功しました。');
	}
	else {
		$('#input_deck').addClass('is-invalid').removeClass('is-valid');
		inform_danger('編成の読み込みに失敗しました。入力されたデータの形式が正しくない可能性があります。');
	}
}

/**
 * 共有リンク生成ボタンクリック
 */
async function btn_output_url_Clicked() {
	try {
		const $output = $('#output_url');
		const url = 'https://noro6.github.io/kcTools/?d=' + encodePreset();
		let shortURL = url;
		await postURLData(url)
			.then(json => {
				if (json.error || !json.shortLink) console.log(json);
				else shortURL = json.shortLink;
			})
			.catch(error => console.error(error));

		$output.val(shortURL);
		$output.nextAll('.valid-feedback').text('生成しました。上記URLをクリックするとクリップボードにコピーされます。');
		$output.removeClass('is-invalid').addClass('is-valid');
	} catch (error) {
		$('#output_url').addClass('is-invalid').removeClass('is-valid');
		return;
	}
}

/**
 * デッキビルダー形式生成ボタンクリック
 */
function btn_output_deck_Clicked() {
	const dataString = convertToDeckBuilder();
	const $output = $('#output_deck');
	$('#output_deck').val(dataString);
	if (dataString) {
		$output.nextAll('.valid-feedback').text('生成しました。上記文字列をクリックするとクリップボードにコピーされます。');
		$output.removeClass('is-invalid').addClass('is-valid');
	}
	else $output.addClass('is-invalid').removeClass('is-valid');
}

/**
 * デッキビルダーサイト展開クリック
 */
function open_deckBuilder() {
	window.open('http://kancolle-calc.net/deckbuilder.html?predeck=' + convertToDeckBuilder());
}

/**
 * 作戦室展開クリック
 */
function open_Jervis() {
	window.open('https://kcjervis.github.io/jervis/?operation-json=' + convertToDeckBuilder_j());
}


/**
 * オート配備開始クリック時
 */
function btn_start_auto_expand_Clicked() {
	// 必須チェック
	if (!$('#auto_land_base_1').prop('checked') &&
		!$('#auto_land_base_2').prop('checked') &&
		!$('#auto_land_base_3').prop('checked') &&
		!$('#auto_fleet').prop('checked')) {
		$('#alert_auto_expand').text('配備対象を選択してください。');
		$('#alert_auto_expand').removeClass('alert-success d-none').addClass('alert-danger');
	}
	else {
		autoExpand();
		$('#alert_auto_expand').text('おまかせ艦載機配備が完了しました。');
		$('#alert_auto_expand').addClass('alert-success').removeClass('alert-danger d-none');
	}
}

/**
 * 出撃形式変更時
 */
function battle_mode_Clicked() {
	// 出撃の場合
	if ($('#mode_1').prop('checked')) {
		$('#auto_fleet').closest('div').removeClass('d-none');
		$('#dest_range_parent').removeClass('d-none');
		$('#details_parent').removeClass('d-none');
	}
	// 防空の場合
	else {
		$('#auto_fleet').prop('checked', false);
		$('#auto_fleet').closest('div').addClass('d-none');
		$('#dest_range_parent').addClass('d-none');
		$('#details_parent').addClass('d-none');
	}
}

/**
 * オート配備対象選択時
 */
function expand_target_Clicked() {
	$('#alert_auto_expand').addClass('d-none');
	$('#btn_start_auto_expand').prop('disabled', false);
	// 基地にチェックがない場合
	if (!$('#auto_land_base_1').prop('checked') && !$('#auto_land_base_2').prop('checked') && !$('#auto_land_base_3').prop('checked')) {
		$('#dest_range').prop('disabled', true);
		// さらに本隊にもチェックがない場合
		if (!$('#auto_fleet').prop('checked')) $('#btn_start_auto_expand').prop('disabled', true);
	}
	else $('#dest_range').prop('disabled', false);
}

/**
 * 目標制空値入力時
 * @param {JQuery} $this
 */
function dest_ap_Changed($this) {
	// 入力検証 -> 数値 かつ 0 以上 max 以下　違ってたら修正
	$this.val(validateInputNumber($this.val(), castInt($this.attr('max'))));
}

/**
 * 簡易計算機敵制空値入力時
 * @param {JQuery} $this
 */
function simple_enemy_ap_Changed($this) {
	// 入力検証 -> 数値 かつ 0 以上 max 以下　違ってたら修正
	const value = validateInputNumber($this.val(), castInt($this.attr('max')));
	$this.val(value);

	const borders = getAirStatusBorder(value);
	for (let i = 0; i < borders.length; i++) {
		$('#border_' + i).text(borders[i]);
	}
}

/**
 * シミュ内タブクリック時
 * @param {JQuery} $this
 */
function simulatorTab_Clicked($this) {
	if ($this[0].dataset.presetid) {
		const activePresets = loadLocalStorage('activePresets');
		const preset = activePresets.presets.find(v => v.id === $this[0].dataset.presetid);
		if (preset) {
			const data = preset.history.histories[preset.history.index];
			expandMainPreset(decodePreset(data));
			calculate();
		}
	}
	else {
		// 見つからなかった場合新規タブ
		let tabData = {
			id: getUniqueId(),
			name: getMaxUntitled(),
			// 全て空のデータ ↓
			history: {
				index: 0,
				histories: [
					'Noi6BpgWgRnX41BYLgAZKe-H6IBEB4cSaA3gQMYCuALgJYB2AkgCYEBcmBATgIZ0AplxjoedfgCMANiM6pwBKQHtebIb1HiAvhBwAzfjIDOQ8EdPnFZIA'
				]
			}
		};
		let activePresets = loadLocalStorage('activePresets');
		if (!activePresets) activePresets = { activeId: "", presets: [] };
		activePresets.presets.push(tabData);
		activePresets.activeId = tabData.id;
		saveLocalStorage('activePresets', activePresets);

		setTab();
		expandMainPreset(decodePreset(tabData.history.histories[0]));
		calculate();
	}
}

/**
 * シミュ内アクティブなタブクリック時
 * @param {JQuery} $this
 */
function simulatorActiveTab_Clicked($this) {
	if ($this[0].dataset.presetid) {
		const activePresets = loadLocalStorage('activePresets');
		const preset = activePresets.presets.find(v => v.id === $this[0].dataset.presetid);
		if (preset) {
			// 編集開始
			$this.addClass('editting');
			$this.find('.fleet_name').addClass('d-none');
			$this.find('.fleet_name_input').removeClass('d-none');
			$this.find('.fleet_name_input').select();
		}
	}
}

/**
 * タブの入力欄からフォーカスアウトしたとき -> 編成名変更す
 * @param {JQuery} $this
 */
function fleet_name_input_Changed($this) {
	const $tab = $this.closest('.fleet_tab');
	const presetid = $tab[0].dataset.presetid;
	let presets = loadLocalStorage('presets');
	if (!presets) presets = [];

	$tab.removeClass('editting');
	$tab.find('.fleet_name').removeClass('d-none');
	$tab.find('.fleet_name_input').addClass('d-none');

	const i = presets.findIndex(v => v[0] === presetid);
	if (i >= 0) {
		let newName = $this.val().trim();
		if (newName && presets[i][1] !== newName) {

			// 50文字超えてたら切る
			if (newName.length > 50) {
				newName = newName.slice(0, 50);
				$this.val(newName);
			}

			presets[i][1] = newName;
			$tab.find('.fleet_name').text(newName);
			saveLocalStorage('presets', presets);
			inform_success('編成名が更新されました。');
		}
	}
	else {
		inform_warning('保存されていないデータの名称変更はできません。');
	}
}

/*==================================
		イベントハンドラ
==================================*/
document.addEventListener('DOMContentLoaded', function () {
	// 画面初期化
	initialize(() => {

		// URLパラメータチェック
		const params = getUrlParams();
		let existURLData = false;
		if (params.hasOwnProperty("d")) {
			// URLから復元した (一般)
			expandMainPreset(decodePreset(params.d));
			existURLData = true;
		}
		else if (params.hasOwnProperty("predeck") || params.hasOwnProperty("lb")) {
			if (params.hasOwnProperty("predeck")) {
				// デッキビルダーー形式で読み込んだ
				const deck = readDeckBuilder(params.predeck);
				if (deck) {
					expandMainPreset(deck, deck[0][0].length > 0, true, false);
				}
			}

			if (params.hasOwnProperty("lb")) {
				// 基地情報も読み込んだ
				try {
					const lbData = JSON.parse(decodeURIComponent(params.lb));
					if (lbData.length >= 2) {
						expandMainPreset([lbData, [], []], true, false, false);
					}
				}
				catch (error) {
					// 基地形式データおかしい場合…読み込まずそっとしておく
				}
			}

			existURLData = true;
		}
		else if (params.hasOwnProperty("p")) {
			// リストページから遷移
			expandMainPreset(decodePreset(params.p));
		}
		else {
			// URL情報に特に引っかからなければ、前回のactiveTabを読み込む（あれば）
			const prevData = getActivePreset();
			if (prevData.id) {
				try {
					expandMainPreset(decodePreset(prevData.history.histories[prevData.history.index]));
				} catch (error) {
					// 死を遂げたらタブ一掃してトップに飛ばす
					deleteLocalStorage('activePresets');
					window.location.href = '../list/';
					return;
				}
			}
			else {
				// 特に何もタブがない場合はlistにリダイレクト
				window.location.href = '../list/';
				return;
			}
		}

		if (existURLData) {
			let presetname = '外部データ';
			if (params.hasOwnProperty("name")) {
				presetname = decodeURIComponent(params.name);
			}
			// 外部編成データが読み込まれたため新しいタブを生成
			let tabData = {
				id: getUniqueId(),
				name: presetname,
				history: { index: 0, histories: [] }
			};
			let activePresets = loadLocalStorage('activePresets');
			if (!activePresets) activePresets = { activeId: "", presets: [] };

			activePresets.presets.push(tabData);
			activePresets.activeId = tabData.id;

			saveLocalStorage('activePresets', activePresets);

			setTab();
		}
		calculate();
	});

	// イベント貼り付け
	$(document).keyup(function (e) { if (isCtrlPress && e.keyCode === 17) isCtrlPress = false; });
	$(document).keydown(function (e) {
		if (!isCtrlPress && e.keyCode === 17) isCtrlPress = true;
		if (isCtrlPress && e.key === "z") {
			btn_undo_Clicked();
		}
		else if (isCtrlPress && e.key === "y") {
			btn_redo_Clicked();
		}
	});
	// トップページへ
	document.getElementById('btn_top').addEventListener('click', () => { window.location.href = '../list/'; });
	$('#header').on('click', '.fleet_tab:not(.active)', function () { simulatorTab_Clicked($(this)); });
	$('#header').on('click', '.fleet_tab.active:not(.editting)', function () { simulatorActiveTab_Clicked($(this)); });
	$('#header').on('blur', '.fleet_name_input', function () { fleet_name_input_Changed($(this)); });
	$('.modal').on('hide.bs.modal', function () { modal_Closed($(this)); });
	$('.modal').on('show.bs.modal', function () { $('.btn_preset').tooltip('hide'); });
	$('.modal').on('click', '.toggle_display_type', function () { toggle_display_type_Clicked($(this)); });
	$('.modal').on('input', '.preset_name', function () { preset_name_Changed($(this)); });
	$('.modal').on('blur', '.preset_name', function () { preset_name_Changed($(this)); });
	$('.slot_select_parent').on('show.bs.dropdown', function () { slot_select_parent_Show($(this)); });
	$('.slot_select_parent').on('hide.bs.dropdown', function () { slot_select_parent_Close($(this)); });
	$('.remodel_select_parent').on('hide.bs.dropdown', function () { remodelSelect_Changed($(this)); });
	$('.remodel_select_parent').on('show.bs.dropdown', function () { remodelSelect_Shown($(this)); });
	$('.prof_select_parent').on('show.bs.dropdown', function () { profSelect_Shown($(this)); });
	$('#main').on('show.bs.collapse', '.collapse', function () { $(this).prev().find('.fa-chevron-up').removeClass('fa-chevron-up').addClass('fa-chevron-down'); });
	$('#main').on('hide.bs.collapse', '.collapse', function () { $(this).prev().find('.fa-chevron-down').removeClass('fa-chevron-down').addClass('fa-chevron-up'); });
	$('#main').on('shown.bs.collapse', '.collapse', function () { $(this).removeClass('tmpHide'); });
	$('#main').on('focus', '.slot_input', function () { $(this).select(); });
	$('#main').on('input', '.slot_input', function () { slot_input_Changed($(this)); });
	$('#main').on('input', '.slot_range', function () { slot_range_Changed($(this)); });
	$('#main').on('click', '.remodel_item', function () { $(this).addClass('remodel_item_selected'); });
	$('#main').on('click', '.plane_name', function () { plane_name_Clicked($(this)); });
	$('#main').on('click', '.btn_plane_preset', function () { btn_plane_preset_Clicked($(this)); });
	$('#main').on('click', '.btn_capture', function () { btn_capture_Clicked($(this)); });
	$('#main').on('click', '.btn_reset_content', function () { btn_reset_content_Clicked($(this)); });
	$('#main').on('click', '.btn_content_trade', function () { btn_content_trade_Clicked($(this)); });
	$('#main').on('click', '.btn_commit_trade', commit_content_order);
	$('#main').on('click', '.btn_ex_setting', function () { btn_ex_setting_Clicked($(this)); });
	$('#main').on('click', '.btn_show_plane_box', function () { btn_show_plane_box_Clicked($(this)) });
	$('#site_warning').on('click', '.cur_pointer', () => { $('#site_warning').removeClass('d-flex').addClass('d-none'); });
	$('#landBase').on('click', '.btn_air_raid', btn_air_raid_Clicked);
	$('#landBase').on('click', '#alert_air_raid_button', btn_air_raid_Clicked);
	$('#landBase').on('click', '.btn_supply', btn_supply_Clicked);
	$('#landBase_content').on('change', '.ohuda_select', calculate);
	$('#landBase_content').on('click', '.btn_remove_plane', function () { btn_remove_lb_plane_Clicked($(this)); });
	$('#landBase_content').on('click', '.btn_reset_landBase', function () { btn_reset_landBase_Clicked($(this)); });
	$('#landBase_content').on('click', '.prof_item', function () { proficiency_Changed($(this)); });
	$('#landBase_content').on('click', '.btn_show_contact_rate_lb', function () { btn_show_contact_rate_lb_Clicked($(this)); });
	$('#landBase_content').on('click', '.btn_toggle_lb_info', function () { btn_toggle_lb_info_Clicked($(this)); });
	$('#landBase_content').on('click', '#toggle_def_mode', toggle_def_mode_Checked);
	$('#friendFleet_content').on('click', '#read_duck_read_warning', function () { $('#duck_read_warning').addClass('d-none'); });
	$('#friendFleet_content').on('change', '.display_ship_count', function () { display_ship_count_Changed($(this)); });
	$('#friendFleet_content').on('click', '.btn_reset_ship_plane', function () { btn_reset_ship_plane_Clicked($(this)); });
	$('#friendFleet_content').on('click', '.ship_name_span', function () { ship_name_span_Clicked($(this)); });
	$('#friendFleet_content').on('click', '.btn_remove_ship', function () { btn_remove_ship_Clicked($(this)); });
	$('#friendFleet_content').on('click', '.btn_remove_plane', function () { btn_remove_ship_plane_Clicked($(this)); });
	$('#friendFleet_content').on({ mouseenter: function () { $(this).closest('.ship_tab').find('.remove_line').addClass('ready'); }, mouseleave: function () { $(this).closest('.ship_tab').find('.remove_line').removeClass('ready'); }, }, '.btn_reset_ship_plane');
	$('#friendFleet_content').on('click', '.prof_item', function () { proficiency_Changed($(this)); });
	$('#friendFleet_content').on('click', '.ship_disabled', function () { ship_disabled_Changed($(this)); });
	$('#friendFleet_content').on('click', '#union_fleet', calculate);
	$('#friendFleet_content .nav-link[data-toggle="tab"]').on('shown.bs.tab', fleet_select_tab_Clicked);
	$('#friendFleet_content').on('click', '.plane_lock', function () { plane_lock_Clicked($(this)); });
	$('#friendFleet_content').on('click', '.plane_unlock', function () { plane_unlock_Clicked($(this)); });
	$('#friendFleet_content').on('click', '.slot_ini', function () { slot_ini_Clicked($(this)); });
	$('#friendFleet_content').on('click', '.btn_show_contact_rate', function () { btn_show_contact_rate_Clicked(); });
	$('#friendFleet_content').on('click', '.btn_antiair_input', btn_antiair_input_Clicked);
	$('#friendFleet_content').on('click', '.form_ship_level', function () { form_ship_level_Clicked($(this)); });
	$('#enemyFleet_content').on('change', '.cell_type', function () { cell_type_Changed($(this)); });
	$('#enemyFleet_content').on('change', '.formation', calculate);
	$('#enemyFleet_content').on('click', '.enemy_content', function () { enemy_name_Clicked($(this)); });
	$('#enemyFleet_content').on('click', '.btn_reset_battle', function () { btn_reset_battle_Clicked($(this)); });
	$('#enemyFleet_content').on('click', '#btn_world_expand', btn_world_expand_Clicked);
	$('#enemyFleet_content').on('click', '.btn_enemy_preset', function () { btn_enemy_preset_Clicked($(this)); });
	$('#enemyFleet_content').on('click', '.btn_stage2', function () { btn_stage2_Clicked($(this)); });
	$('#enemyFleet_content').on('change', '#battle_count', function () { battle_count_Changed($(this)); });
	$('#enemyFleet_content').on('click', '#btn_lb_target', btn_lb_target_Clicked);
	$('#enemyFleet_content').on('click', 'input[name="enemy_fleet_display_mode"]', function () { enemy_fleet_display_mode_Changed($(this)); });
	$('#result').on('click', '#btn_calculate', calculate);
	$('#result_content').on('click', '#display_battle_tab .nav-item', function () { display_battle_tab_Changed($(this)); });
	$('#result_content').on('click', '#empty_slot_invisible', calculate);
	$('#result_content').on('click', '#display_setting .custom-control-input', display_result_Changed);
	$('#result_content').on('click', '#shoot_down_table_tbody tr', function () { fleet_slot_Clicked($(this)); });
	$('#result_content').on('click', '#rate_table .land_base_detail', function () { land_base_detail_Clicked($(this)); });
	$('#result_content').on('click', '#enemy_shoot_down_tbody .td_detail_slot', function () { enemy_slot_Clicked($(this)); });
	$('#result_content').on('click', '.btn_antiair_input', btn_antiair_input_Clicked);
	$('#result_content').on('click', '#ignore_stage2', calculate);
	$('#config_content').on('focus', '#calculate_count', function () { $(this).select(); });
	$('#config_content').on('input', '#calculate_count', function () { calculate_count_Changed($(this)); });
	$('#config_content').on('click', '#innerProfSetting .custom-control-input', function () { innerProfSetting_Clicked($(this)); });
	$('#config_content').on('click', '#clipboard_mode', clipboard_mode_Clicked);
	$('#config_content').on('click', '.dropdown-item', function () { init_proficiency_Changed($(this)); });
	$('#config_content').on('click', '#btn_reset_selected_plane_history', btn_reset_selected_plane_history_Clicked);
	$('#config_content').on('click', '#btn_reset_selected_ship_history', btn_reset_selected_ship_history_Clicked);
	$('#stock_management').on('show.bs.collapse', '.collapse', function () { setPlaneStockTable(); setShipStockTable(); });
	$('#ship_stock').on('change', '#ship_stock_type_select', ship_stock_type_select_Changed);
	$('#ship_stock').on('input', '.stock_td_stock', function () { stock_td_stock_Changed($(this)); });
	$('#ship_stock').on('click', '.stock_td_fav', function (e) { ship_stock_td_fav_Clicked($(this)); e.stopPropagation(); });
	$('#ship_stock').on('input', '#input_ship_json', function () { input_ship_json_Changed($(this)); });
	$('#ship_stock').on('focus', '#input_ship_json', function () { $(this).select(); });
	$('#ship_stock').on('click', '#btn_fav_ship_clear', btn_fav_ship_clear_Clicked);
	$('#ship_stock').on('click', '#btn_ship_stock_all_clear', btn_ship_stock_all_clear_Clicked);
	$('#ship_stock').on('input', '#ship_stock_word', ship_stock_word_TextChanged);
	$('#ship_stock').on('click', '#btn_load_ship_json', btn_load_ship_json_Clicked);
	$('#plane_stock').on('change', '#stock_type_select', stock_type_select_Changed);
	$('#plane_stock').on('click', '.stock_td_fav', function (e) { stock_td_fav_Clicked($(this)); e.stopPropagation(); });
	$('#plane_stock').on('click', '.stock_tr', function () { stock_tr_Clicked($(this)); });
	$('#plane_stock').on('click', '#btn_load_equipment_json', btn_load_equipment_json_Clicked);
	$('#plane_stock').on('input', '#input_equipment_json', function () { input_equipment_json_Changed($(this)); });
	$('#plane_stock').on('focus', '#input_equipment_json', function () { $(this).select(); });
	$('#plane_stock').on('click', '#btn_fav_clear', btn_fav_clear_Clicked);
	$('#plane_stock').on('click', '#btn_stock_all_clear', btn_stock_all_clear_Clicked);
	$('#plane_stock').on('input', '#stock_word', stock_word_TextChanged);
	$('#manage_manual_data').on('show.bs.collapse', '.collapse', manage_manual_enemu_content_Shown);
	$('#manage_manual_data').on('click', '.manual_enemy_tr', function () { manul_enemy_Clicked($(this)); });
	$('#modal_plane_select').on('click', '.plane', function () { modal_plane_Selected($(this)); });
	$('#modal_plane_select').on('click', '.btn_remove', function () { modal_plane_select_btn_remove_Clicked($(this)); });
	$('#modal_plane_select').on('click', '#plane_type_select .nav-link', function () { plane_type_select_Changed($(this)) });
	$('#modal_plane_select').on('click', '#fav_only', fav_only_Checked_Chenged);
	$('#modal_plane_select').on('click', '#disp_in_stock', disp_in_stock_Checked_Chenged);
	$('#modal_plane_select').on('click', '#divide_stock', divide_stock_Checked_Chenged);
	$('#modal_plane_select').on('click', '#disp_equipped', disp_equipped_Checked_Chenged);
	$('#modal_plane_select').on('input', '#plane_word', plane_word_TextChanged);
	$('#modal_plane_select').on('change', '#plane_sort_select', function () { sort_Changed($(this)); });
	$('#modal_plane_select').on('change', '#plane_filter_key_select', plane_filter_Changed);
	$('#modal_plane_select').on('change', '#plane_filter_value', plane_filter_Changed);
	$('#modal_plane_preset').on('click', '.preset_tr', function () { plane_preset_tr_Clicked($(this)); });
	$('#modal_plane_preset').on('click', '.btn_commit_preset', function () { btn_commit_plane_preset_Clicked($(this)); });
	$('#modal_plane_preset').on('click', '.btn_delete_preset', function () { btn_delete_plane_preset_Clicked($(this)); });
	$('#modal_plane_preset').on('click', '.btn_expand_preset', btn_expand_plane_preset_Clicked);
	$('#modal_ship_select').on('change', '#ship_type_select', function () { createShipTable(castInt($(this).val())); });
	$('#modal_ship_select').on('click', '.ship_tr:not(.ship_tr_disabled)', function () { modal_ship_Selected($(this)); });
	$('#modal_ship_select').on('click', '.btn_remove', function () { modal_ship_select_btn_remove_Clicked($(this)); });
	$('#modal_ship_select').on('click', '#display_final', () => { createShipTable(castInt($('#ship_type_select').val())); });
	$('#modal_ship_select').on('click', '#frequent_ship', () => { createShipTable(castInt($('#ship_type_select').val())); });
	$('#modal_ship_select').on('click', '#fav_only_ship', () => { createShipTable(castInt($('#ship_type_select').val())); });
	$('#modal_ship_select').on('click', '#disp_in_stock_ship', () => { createShipTable(castInt($('#ship_type_select').val())); });
	$('#modal_ship_select').on('click', '#disp_equipped_ship', () => { createShipTable(castInt($('#ship_type_select').val())); });
	$('#modal_ship_select').on('input', '#ship_word', ship_word_TextChanged);
	$('#modal_enemy_select').on('click', '.modal-body .enemy', function () { modal_enemy_Selected($(this)); });
	$('#modal_enemy_select').on('click', '.btn_remove', function () { modal_enemy_select_btn_remove($(this)); });
	$('#modal_enemy_select').on('change', '#enemy_type_select', function () { createEnemyTable([castInt($(this).val())]); });
	$('#modal_enemy_select').on('input', '#enemy_word', enemy_word_TextChanged);
	$('#modal_enemy_pattern').on('show.bs.modal', modal_enemy_pattern_Shown);
	$('#modal_enemy_pattern').on('click', '.node_tr', function () { node_tr_Clicked($(this)); });
	$('#modal_enemy_pattern').on('change', '#map_select', createNodeSelect);
	$('#modal_enemy_pattern').on('change', '#node_select', createEnemyPattern);
	$('#modal_enemy_pattern').on('change', '#select_difficulty', createNodeSelect);
	$('#modal_enemy_pattern').on('click', '#btn_expand_enemies', btn_expand_enemies);
	$('#modal_enemy_pattern').on('click', '#btn_continue_expand', btn_continue_expand_Clicked);
	$('#modal_enemy_pattern').on('click', '.node', function () { node_Clicked($(this)) });
	$('#modal_enemy_pattern').on('click', '#enemy_pattern_select .nav-link:not(.active)', function () { pattern_Changed($(this)) });
	$('#modal_enemy_pattern').on('click', 'input[name="enemy_display_mode"]', function () { enemy_display_mode_Changed($(this)) });
	$('#modal_enemy_pattern').on('dblclick', '.node', node_DoubleClicked);
	$('#modal_enemy_pattern').on('dblclick', '.node_tr', node_DoubleClicked);
	$('#modal_enemy_pattern').on('dblclick', '#enemy_pattern_select .nav-link.active', node_DoubleClicked);
	$('#modal_main_preset').on('show.bs.modal', modal_main_preset_Shown);
	$('#modal_main_preset').on('change', '#select_preset_category', select_preset_category_Changed);
	$('#modal_main_preset').on('click', '.btn_commit_preset', btn_commit_main_preset_Clicked);
	$('#modal_main_preset').on('click', '#allow_upload_preset', allow_upload_preset_Clicked);
	$('#modal_main_preset').on('click', '#btn_upload_preset', btn_upload_preset_Clicked);
	$('#modal_main_preset').on('input', '#input_preset_name', function () { preset_name_Changed($(this)); });
	$('#modal_main_preset').on('input', '#preset_remarks', function () { preset_remarks_Changed($(this)); });
	$('#modal_share').on('click', '.btn_load_deck', btn_load_deck_Clicked);
	$('#modal_share').on('input', '#input_deck', function () { input_deck_Changed($(this)); });
	$('#modal_share').on('focus', '#input_deck', function () { $(this).select(); });
	$('#modal_share').on('click', '.btn_output_url', btn_output_url_Clicked);
	$('#modal_share').on('click', '.btn_output_deck', btn_output_deck_Clicked);
	$('#modal_share').on('focus', '#output_url', function () { $(this).select(); });
	$('#modal_share').on('focus', '#output_deck', function () { $(this).select(); });
	$('#modal_share').on('input', '#output_url', function () { output_data_Changed($(this)); });
	$('#modal_share').on('input', '#output_deck', function () { output_data_Changed($(this)); });
	$('#modal_share').on('click', '#output_url', function () { output_data_Clicked($(this)); });
	$('#modal_share').on('click', '#output_deck', function () { output_data_Clicked($(this)); });
	$('#modal_share').on('click', '#open_deckBuilder', open_deckBuilder);
	$('#modal_share').on('click', '#open_jervis', open_Jervis);
	$('#modal_auto_expand').on('click', '#btn_start_auto_expand', btn_start_auto_expand_Clicked);
	$('#modal_auto_expand').on('click', '#expand_target .custom-control-input', expand_target_Clicked);
	$('#modal_auto_expand').on('click', '#auto_battle_mode .custom-control-input', battle_mode_Clicked);
	$('#modal_auto_expand').on('input', '#simple_enemy_ap', function () { simple_enemy_ap_Changed($(this)); });
	$('#modal_auto_expand').on('input', '#dest_ap', function () { dest_ap_Changed($(this)); });
	$('#modal_auto_expand').on('input', '#dest_range', function () { dest_ap_Changed($(this)); });
	$('#modal_plane_stock').on('input', '.stock_num', function () { stock_Changed($(this)); });
	$('#modal_plane_stock').on('click', '#btn_save_stock', btn_save_stock_Clicked);
	$('#modal_plane_stock').on('click', '#btn_stock_reset', btn_stock_reset_Clicked);
	$('#modal_result_detail').on('click', '#btn_calculate_detail', btn_calculate_detail);
	$('#modal_result_detail').on('change', '#detail_calculate_count', () => $('#btn_calculate_detail').prop('disabled', false));
	$('#modal_result_detail').on('change', '.custom-radio', btn_calculate_detail);
	$('#modal_result_detail').on('click', '#show_detail_slot .nav-item', function () { detail_slot_tab_Changed($(this)); });
	$('#modal_result_detail').on('click', '.btn_show_detail:not(.disabled)', function () { btn_show_detail_Clicked($(this)); });
	$('#modal_result_detail').on('click', '#btn_output_slot_dist', btn_output_slot_dist_Clicked);
	$('#modal_result_detail').on('click', '#btn_output_slot_dist_table', btn_output_slot_dist_table_Clicked);
	$('#modal_collectively_setting').on('click', '.btn_remove_plane_all', function () { btn_remove_plane_all_Clicked($(this)); });
	$('#modal_collectively_setting').on('click', '.btn_remove_ship_all', btn_remove_ship_all_Clicked);
	$('#modal_collectively_setting').on('click', '.btn_slot_max', function () { btn_slot_max_Clicked($(this)); });
	$('#modal_collectively_setting').on('click', '.btn_slot_min', btn_slot_min_Clicked);
	$('#modal_collectively_setting').on('click', '.btn_slot_default', function () { btn_slot_default_Clicked($(this)); });
	$('#modal_collectively_setting').on('input', '.coll_slot_range', function () { coll_slot_range_Changed($(this)); });
	$('#modal_collectively_setting').on('input', '.coll_slot_input', function () { coll_slot_input_Changed($(this)); });
	$('#modal_collectively_setting').on('focus', '.coll_slot_input', function () { $(this).select(); });
	$('#modal_collectively_setting').on('click', '.btn_remodel', function () { btn_remodel_Clicked($(this)); });
	$('#modal_collectively_setting').on('click', '.btn_fighter_prof_max', btn_fighter_prof_max_Clicked);
	$('#modal_collectively_setting').on('click', '.btn_prof', function () { btn_prof_Clicked($(this)); });
	$('#modal_stage2_detail').on('input', '#stage2_detail_slot', stage2_slot_input_Changed);
	$('#modal_stage2_detail').on('change', '#stage2_detail_avoid', calculateStage2Detail);
	$('#modal_stage2_detail').on('input', '#free_anti_air_weight', function () { free_modify_input_Changed($(this)) });
	$('#modal_stage2_detail').on('input', '#free_anti_air_bornus', function () { free_modify_input_Changed($(this)) });
	$('#modal_contact_detail').on('change', '.custom-radio', contact_detail_redraw);
	$('#modal_fleet_antiair_input').on('focus', '#fleet_antiair_base', function () { $(this).select(); });
	$('#modal_fleet_antiair_input').on('input', '#fleet_antiair_base', fleet_antiair_base_TextChanged);
	$('#modal_fleet_antiair_input').on('input', '#fleet_antiair', fleet_antiair_TextChanged);
	$('#modal_fleet_antiair_input').on('input', '.antiair_weight', updateFleetStage2Table);
	$('#modal_fleet_antiair_input').on('click', '.reset', resetFleetAntiairInput);
	$('#modal_fleet_antiair_input').on('change', '#antiair_grand', antiair_grand_Changed);
	$('#modal_fleet_antiair_input').on('change', '#antiair_air_raid', updateFleetStage2Table);
	$('#modal_fleet_antiair_input').on('change', '#fleet_antiair_formation', updateFleetStage2Table);
	$('#modal_fleet_antiair_input').on('input', '#import_antiair', import_antiair_Changed);
	$('#modal_fleet_antiair_input').on('click', '#btn_import_antiair', btn_import_antiair_Clicked);
	$('#modal_fleet_antiair_input').on('change', '.select_antiair_cutin_td', function () { antiAirCutinChanged($(this)); });
	$('#modal_fleet_antiair_input').on('input', '.cutin_rate', function () { updateAntiAirCutinRate($(this)); });
	$('#modal_fleet_antiair_input').on('click', '.btn_remove_cutin.cur_pointer', function () { btn_remove_cutin_Clicked($(this)); });
	$('#modal_fleet_antiair_input').on('click', '.cutin_visible', function () { cutin_visible_Clicked($(this)); });
	$('#back_ci_setting').on('show.bs.tab', function () { $('#back_ci_setting').addClass('d-none'); $('#go_ci_setting').removeClass('d-none'); });
	$('#go_ci_setting').on('show.bs.tab', function () { $('#go_ci_setting').addClass('d-none'); $('#back_ci_setting').removeClass('d-none'); });
	$('#modal_manual_enemy').on('input', '.enemy_slot', function () { manual_enemy_input_Changed($(this)) });
	$('#modal_manual_enemy').on('input', '#manual_aa_bonus', function () { manual_enemy_input_Changed($(this)) });
	$('#modal_manual_enemy').on('change', '.enemy_planes', calculateVirtualEnemy);
	$('#modal_manual_enemy').on('click', '#commit_enemy', commit_enemy_Clicked);
	$('#modal_manual_enemy').on('click', '#rollback_enemy', rollback_enemy_Clicked);
	$('#modal_lb_target').on('click', '.btn', function () { btn_target_Clicked($(this)) });
	$('#modal_level_input').on('focus', '.ship_level_input', function () { $(this).select(); });
	$('#modal_level_input').on('input', '.ship_level_input', function () { ship_level_input_Changed($(this)); });
	$('#modal_level_input').on('input', '.ship_level_range', function () { ship_level_range_Changed($(this)); });
	$('#modal_level_input').on('click', '.btn-sm', function () { level_Clicked($(this)); });
	$('#modal_confirm').on('click', '.btn_ok', modal_confirm_ok_Clicked);
	$('#modal_confirm').on('click', '#error_str', function () { if (copyInputTextToClipboard($(this))) inform_success('コピーしました'); });
	$('#modal_confirm').on('click', '#send_error', sendError);
	$('#btn_save_preset').click(btn_save_preset_Clicked);
	$('#btn_save_preset_sub').click(btn_save_preset_sub_Clicked);
	$('#btn_auto_expand').click(btn_auto_expand_Clicked);
	$('#btn_twitter').click(btn_twitter_Clicked);
	$('#btn_share').click(() => { $('#modal_share').modal('show'); });
	$('#btn_undo').click(btn_undo_Clicked);
	$('#btn_redo').click(btn_redo_Clicked);
	$('#input_url').click(function () { $(this).select(); });
	$('#btn_url_shorten').click(btn_url_shorten_Clicked);
	$('#draggable_plane_box').on('click', '#btn_hide_plane_box', function () { $('#draggable_plane_box').addClass('d-none'); });
	$('#draggable_plane_box').on('click', '#draggable_plane_type_select .nav-link', function () { createDraggablePlaneTable($(this)) });
	$('#draggable_plane_box').on('change', '#draggable_plane_sort_select', function () { createDraggablePlaneTable(); });
	$('#modal_plane_select').on({
		mouseenter: function () {
			const $this = $(this);
			timer = setTimeout(function () { showPlaneBasicToolTip($this); }, 500);
		},
		mouseleave: function () {
			if (timer) clearTimeout(timer);
			hideTooltip($(this)[0]);
		}
	}, '.plane_tr, .plane_tr_disabled');
	$('#landBase_content').on({
		mouseenter: function () { showPlaneToolTip($(this).parent(), true); },
		mouseleave: function () { hideTooltip($(this).parent()[0]); }
	}, '.plane_img');
	$('#friendFleet_content').on({
		mouseenter: function () { showPlaneToolTip($(this).parent()); },
		mouseleave: function () { hideTooltip($(this).parent()[0]); }
	}, '.plane_img');
	$('#friendFleet_content').on({
		mouseenter: function () { showTooltip($(this)[0], "ロックすると、おまかせ配備使用時にこのスロットの上書きを保護できます。"); },
		mouseleave: function () { hideTooltip($(this)[0]); }
	}, '.plane_unlock');
	$('#friendFleet_content').on({
		mouseenter: function () { showTooltip($(this)[0], "ロック中です。おまかせ配備使用時、このスロットは変更されません。"); },
		mouseleave: function () { hideTooltip($(this)[0]); }
	}, '.plane_lock');
	$('#friendFleet_content').on({
		mouseenter: function () { showTooltip($(this)[0], "艦娘、装備は維持したまま計算対象から省きます。"); },
		mouseleave: function () { hideTooltip($(this)[0]); }
	}, '.ship_disabled');
	$('#main').on({
		mouseenter: function () { showTooltip($(this)[0], "機体プリセット"); },
		mouseleave: function () { hideTooltip($(this)[0]); }
	}, '.btn_plane_preset');
	$('#landBase_content').on({
		mouseenter: function () { showTooltip($(this)[0], "装備リセット"); },
		mouseleave: function () { hideTooltip($(this)[0]); }
	}, '.btn_reset_landBase');
	$('#friendFleet_content').on({
		mouseenter: function () { showTooltip($(this)[0], "装備リセット"); },
		mouseleave: function () { hideTooltip($(this)[0]); }
	}, '.btn_reset_ship_plane');
	$('#friendFleet_content').on({
		mouseenter: function () { showTooltip($(this)[0], "閉じる"); },
		mouseleave: function () { hideTooltip($(this)[0]); }
	}, '.btn_remove_ship');
	$('#result_content').on({
		mouseenter: function () { shoot_down_table_tbody_MouseEnter($(this)); },
		mouseleave: function () { shoot_down_table_tbody_MouseLeave($(this)); }
	}, '#shoot_down_table_tbody td');
	$('#result_content').on({
		mouseenter: function () { progress_area_MouseEnter($(this)); },
		mouseleave: function () { progress_area_MouseLeave($(this)); }
	}, '.progress_area');
	$('#result_content').on({
		mouseenter: function () { rate_table_MouseEnter($(this)); },
		mouseleave: function () { rate_table_MouseLeave($(this)); }
	}, '#rate_table tbody td');
	$('#result_content').on({
		mouseenter: function () { enemy_shoot_down_table_tbody_MouseEnter($(this)); },
		mouseleave: function () { enemy_shoot_down_table_tbody_MouseLeave($(this)); }
	}, '#enemy_shoot_down_tbody td');
	$('#result_content').on({
		mouseenter: function () { showEnemyPlaneToolTip($(this)); },
		mouseleave: function () { hideTooltip($(this)[0]); }
	}, '.img-size-36');

	// 画面サイズ変更
	$(window).resize(function () {
		if (timer) clearTimeout(timer);
		timer = setTimeout(function () {
			if ($('#lb_tab_select').css('display') !== 'none' && !$('#lb_item1').attr('class').includes('tab-pane')) {
				$('.lb_tab').addClass('tab-pane fade');
				$('.lb_tab:first').tab('show');
				$('.baseNo').removeClass('sortable_handle cur_move');
			}
			else if ($('#lb_tab_select').css('display') === 'none' && $('#lb_item1').attr('class').includes('tab-pane')) {
				$('.lb_tab').removeClass('tab-pane fade').show().fadeIn();
				$('.baseNo').addClass('sortable_handle cur_move');
			}
		}, 50);
	});

	/*==================================
			ドラッグ & ドロップ
	==================================*/
	Sortable.create($('#main')[0], {
		handle: '.trade_enabled',
		animation: 200,
		scroll: true,
		onEnd: main_contents_Sortable_End
	});
	Sortable.create($('#battle_result')[0], {
		handle: '.drag_handle',
		animation: 200,
		scroll: true,
	});
	Sortable.create($('#lb_tab_parent')[0], {
		handle: '.sortable_handle',
		animation: 200,
		onEnd: function () {
			// 第何航空隊か整合性取る
			$('.lb_tab').each((i, e) => {
				$(e).attr('id', 'lb_item' + (i + 1));
				$(e).find('.baseNo').html('<span>第' + (i + 1) + '基地航空隊</span>');
				$(e).find('.simple_lb_progress').each((ii, ee) => {
					$(ee).attr('id', `simple_lb_bar_${i + 1}_${ii + 1}`);
				});
				$(e).find('.btn_show_contact_rate_lb')[0].dataset.lb = (i + 1);
			});
			calculate();
		}
	});
	$('.fleet_tab').each((i, e) => {
		Sortable.create($(e)[0], {
			handle: '.sortable_handle',
			animation: 200,
			scroll: true,
			onEnd: function () {
				// 艦何番目か整合性取る
				$('.ship_tab').each((i, e) => {
					$(e).attr('id', 'shipNo_' + (i + 1));
				});
				calculate();
			}
		});
	});

	$('.lb_plane').draggable({
		delay: 100,
		helper: 'clone',
		handle: '.drag_handle',
		zIndex: 1000,
		start: function (e, ui) {
			$(ui.helper).css('width', 320);
			$(ui.helper).find('.dropdown-menu').remove();
		},
		stop: function () { lb_plane_DragEnd($(this)); }
	});
	$('.lb_plane').droppable({
		accept: ".lb_plane, .plane_tr_draggable",
		hoverClass: "plane_draggable_hover",
		tolerance: "pointer",
		drop: function (e, ui) { lb_plane_Drop($(this), ui); }
	});
	$('#landBase_content_main').droppable({
		accept: ".lb_plane",
		tolerance: "pointer",
		over: (e, ui) => {
			ui.helper.animate({ 'opacity': '1.0' }, 100);
			isOut = false;
		},
		out: (e, ui) => {
			ui.helper.animate({ 'opacity': '0.2' }, 100);
			isOut = true;
		}
	});

	$('.ship_plane_draggable').draggable({
		delay: 100,
		helper: 'clone',
		handle: '.drag_handle',
		zIndex: 1000,
		cursorAt: { left: 55 },
		start: function (e, ui) { ship_plane_DragStart(ui); },
		stop: function () { ship_plane_DragEnd($(this)); }
	});
	$('.ship_plane').droppable({
		accept: ".ship_plane_draggable, .plane_tr_draggable",
		hoverClass: "plane_draggable_hover",
		tolerance: "pointer",
		over: function (e, ui) { ship_plane_DragOver($(this), ui); },
		drop: function (e, ui) { ship_plane_Drop($(this), ui); }
	});
	$('.friendFleet_tab').droppable({
		accept: ".ship_plane_draggable",
		tolerance: "pointer",
		over: function (e, ui) {
			isOut = false;
			ui.helper.stop().animate({ 'opacity': '1.0' }, 100);
		},
		out: function (e, ui) {
			isOut = true;
			ui.helper.stop().animate({ 'opacity': '0.2' }, 100);
		}
	});

	Sortable.create($('#battle_container')[0], {
		handle: '.sortable_handle',
		animation: 150,
		onEnd: function () {
			// 何戦目か整合性取る
			$('.battle_content').each((i, e) => { $(e).find('.battle_no').text(i + 1); });
			calculate();
		}
	});

	$('#draggable_plane_box').draggable({ handle: '.drag_handle' });

	$('#main').fadeIn();
	$('#simulator_loading').remove();
});