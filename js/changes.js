/** 変更履歴 */
let CHANGE_LOG = [
	{ id: "0.0.1", changes: [{ type: 0, title: "設置", content: "初版設置" }] },
	{ id: "1.0.0", changes: [{ type: 0, title: "艦娘制空計算機能を実装しました。", content: "基本の機能です。" }] },
	{
		id: "1.0.1", changes: [
			{
				type: 0, title: "艦娘を12隻まで設定できるようになりました。",
				content: "レイアウトの都合上、第1艦隊、第2艦隊と別れていますが、両艦隊の制空値を合算して計算します。"
			},
			{ type: 0, title: "艦娘単位の制空値を表示するようにしました。", content: "各艦娘名の横に表示されます。" },
		]
	},
	{
		id: "1.1.0", changes: [
			{
				type: 0, title: "基地航空隊を新設しました。",
				content: "集中、単発、待機から選択可能です。機体が存在しない航空隊はゲーム同様、待機に固定されます。変更する場合は、最初に機体を選択してください。"
			},
			{
				type: 0, title: "基地航空隊による敵機撃墜を考慮できるようになりました。",
				content: "結果は、実際に第1基地航空隊から本隊の制空争いまでを1連の試行として反復するモンテカルロ法シミュレーションによって導出します。"
			},
		]
	},
	{
		id: "1.1.1", changes: [
			{
				type: 0, title: "敵艦の制空値直接入力機能を実装しました。",
				content: "敵艦選択から「直接入力」を選択したのち、制空値をクリックすると自由に設定できます。ここで入力した制空値は、基地航空隊の撃墜対象になりません。"
			}
		]
	},
	{
		id: "1.1.2", changes: [
			{
				type: 0, title: "機体のドラッグ&amp;ドロップによる入れ替え機能を実装しました。"
				, content: "入れ替えたい対象の機体の機体アイコン、または機体名付近をドラッグし、入れ替えたい位置までドラッグしてください。"
			}
		]
	},
	{
		id: "1.1.3", changes: [
			{
				type: 0, title: "艦娘間の装備入れ替えについて、適合しない装備を考慮するようにしました。",
				content: "適合しない装備は入れ替えられません。また、搭載できない装備が交換されてきた場合は自動的に外されます。"
			},
			{
				type: 0, title: "機体をドロップ時、機体を複製できる機能を追加しました。",
				content: "詳細設定欄で設定、またはCtrlキーを押下した状態で機体をドロップすると機体が複製されて挿入されます。"
			}
		]
	},
	{
		id: "1.1.4", changes: [
			{ type: 0, title: "5スロット艦に対応しました。", content: "該当する艦娘を編成した場合のみ表示されます。" },
			{
				type: 0, title: "基地航空隊各隊毎に、出撃/配備時の資源消費を確認できるようになりました。",
				content: "燃料、弾薬は<u>出撃時に自動的に消費される量</u>、ボーキサイトは<u>未配備の基地から現在の装備構成にした場合に自動的に消費される量</u>です。"
			},
		]
	},
	{
		id: "1.2.0", changes: [
			{
				type: 0, title: "防空計算に対応しました。",
				content: "3部隊同時設定可能です。いずれかの航空隊を「防空」に設定すると、他の航空隊で「集中」「単発」に設定するまで防空モードとなります。"
			},
		]
	},
	{
		id: "1.2.1", changes: [
			{
				type: 0, title: "機体プリセット機能を追加しました。",
				content: "デフォルトでいくつかプリセットが登録されていますが、削除して問題ありません。"
			},
		]
	},
	{
		id: "1.3.0", changes: [
			{
				type: 0, title: "道中における、自艦隊の被撃墜に対応しました。",
				content: "敵艦隊欄から、目的の戦闘までの道中の戦闘回数を選択し、それぞれの敵艦隊を選択してください。"
			},
			{
				type: 0, title: "防空時において、対重爆時の制空値計算に対応しました。",
				content: "重爆対象の敵艦を選択し、防空を選択すると考慮します。入力情報欄には常に対重爆時の制空値が表示されます。"
			}
		]
	},
	{
		id: "1.3.1", changes: [
			{
				type: 0, title: "機体、艦娘、および敵艦の選択画面の複数列表示機能を実装しました。",
				content: "各種選択欄内の、カテゴリの右欄で切り替えられます。ブラウザの横幅によってはあまり恩恵がありません。ソート順は図鑑No順です。"
			},
			{
				type: 0, title: "海域一覧からの敵艦隊入力に対応しました。",
				content: "各戦闘の「海域選択」をクリックすると海域選択が可能です。ここから敵情報を選択した場合、基地航空隊の半径も考慮されます。"
			},
			{
				type: 0, title: "各敵艦隊との戦闘順の入れ替え機能を実装しました。",
				content: "ドラッグ&amp;ドロップで入れ替えらます。戦闘回数、総制空値の欄からドラッグできます。"
			},
		]
	},
	{
		id: "1.3.2", changes: [
			{
				type: 0, title: "自動編成記録機能を実装しました。",
				content: "サイト再表示時、前回の編成データがあれば復帰する機能です。「詳細設定」から本機能の ON/OFF を切り替えられます。"
			},
			{
				type: 0, title: "入力情報の保存・展開機能を実装しました。",
				content: "入力した基地、艦娘、敵艦情報をまとめてブラウザに保存できます。画面右上の「編成保存・展開」ボタンから登録・編集可能です。"
			},
			{
				type: 0, title: "外部サイトからの編成取り込み機能を実装しました。",
				content: "現在は「艦隊シミュレーター＆デッキビルダー」形式のデータに対応しています。画面右上の「編成保存・展開」ボタンから取り込みが可能です。"
			},
			{
				type: 0, title: "編成の共有機能を実装しました。",
				content: "編成のURL生成や、「艦隊シミュレーター＆デッキビルダー」形式のデータを出力できます。共有URLに関して、文字数制限のあるサイトなどに貼り付ける場合は、適宜短縮URLサービスなどを利用して下さい。"
			},
		],
	},
	{
		id: "1.3.3", changes: [
			{
				type: 0, title: "艦隊毎の制空値表示を行うようにしました。",
				content: "各艦隊選択欄の下部、表示隻数の右側に表示されています。"
			},
			{
				type: 1, title: "海域選択が分かり辛かったので表示方法を変更しました。",
				content: "アイコンからボタン式になっています。機能に変更はありません。レイアウトは暫定です。"
			},
			{
				type: 1, title: "防空から集中等にした際、他の部隊は待機にするようにしました。",
				content: "防空や集中、単発を同時に選択できないのは仕様です。現状、両計算を同時に行うことはできません。"
			},
			{
				type: 2, title: "日進に大型飛行艇を搭載した際の初期搭載数を修正しました。",
				content: "1機です。知りませんでしたm(_ _)m　なお、その他の機体と同様、手動で搭載数を変更する場合は1機以上を設定しても問題ありません。"
			},
			{
				type: 2, title: "ドラッグ&amp;ドロップ時の挙動の不具合を修正しました。",
				content: "艦隊欄でのドラッグ&amp;ドロップ時に改修値がおかしくなる現象、偵察機系の最大搭載数がおかしくなる現象を修正しました。"
			},
		],
	},
	{
		id: "1.3.4", changes: [
			{
				type: 0, title: "公開しました。",
				content: "デバッグ、動作検証に参加していただいた方、ありがとうございました。今後も改善案や要望、バグ報告など随時受け付けており、変更/修正/機能追加があった場合はお知らせしていきます。"
			},
			{
				type: 0, title: "海域からセルを選択した際に進行航路を表示するようにしました。",
				content: "自由にセルを設定できるため、ゲーム上あり得ない航路になることもあります。なお、別の海域を混ぜると無効です。"
			},
			{
				type: 2, title: "デッキビルダーからの編成取り込み機能の不具合を修正しました。",
				content: "第2艦隊を設定しなかった場合において、特定の条件で取り込みができない現象を修正しました。"
			},
			{
				type: 2, title: "レイアウトの一部修正を行いました。",
				content: "更新履歴欄において、一部文字が枠をはみ出していた部分を修正しました。"
			},
		],
	},
	{
		id: "1.3.5", changes: [
			{
				type: 0, title: "2019秋イベント 対応",
				content: "確認できた敵編成から順次追加していきます。今後、強編成等が確認された場合は編成が変わる可能性があります。"
			},
		],
	},
	{
		id: "1.3.6", changes: [
			{
				type: 1, title: "第2艦隊の制空権争い参加の挙動を変更しました。",
				content: "対敵連合艦隊時にのみ、第2艦隊の制空値も考慮します。敵艦が連合艦隊を組んでいるマスは、各マスの「敵連合」にチェックを入れてください。"
			},
			{
				type: 0, title: "結果表示の際、空スロットを省略表示できるようにしました。",
				content: "結果表示欄の「未搭載スロットを非表示にする」にチェックを入れると表示を切り替えられます。選択状態は次回起動時にも引き継ぎます。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "長門型改に水上戦闘機、速吸改に艦上攻撃機が搭載できない現象の修正、三式戦 飛燕 の改修値を変更できない現象を修正しました。"
			},
		],
	},
	{
		id: "1.3.7", changes: [
			{
				type: 1, title: "一括設定をより細かく設定できるようになりました。",
				content: "基地/艦娘単位で、各機体の搭載数、改修値、熟練度を自由に設定できるようになりました。一括設定は <i class='fas fa-wrench'></i> アイコンをクリックすると起動します。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "ページ下部、 サイトについて > 使い方 欄の訂正を行いました。"
			},
		],
	},
	{
		id: "1.3.8", changes: [
			{
				type: 0, title: "計算結果欄に各種制空状態ボーダーを表示するようにしました。",
				content: "基地航空隊を派遣した場合、基準となる表示敵制空値は「平均値」となりますので、実際の制空状態ボーダーは表示値から前後する点に注意してください。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "保存した海域セル選択状況がうまく復帰できていなかった不具合、プリセット新規登録時の不具合を修正しました。"
			},
		],
	},
	{
		id: "1.4.0", changes: [
			{
				type: 0, title: "敵の対空砲火による撃墜(stage2)処理を実装しました。",
				content: "同機能実装に伴い、より正確な道中の被撃墜計算を行うには、制空争いに関係ない敵艦(駆逐艦や潜水艦など)の入力が必要になります。なお、計算結果欄の出撃後搭載数、および制空値はシミュレート全体における平均値が表示されています。"
			},
			{
				type: 0, title: "出撃終了時の艦載機全滅率の表示を追加しました。",
				content: "それぞれにマウスホバー(スマホではタップ)すると、シミュレーション全体での出撃後搭載数の最大、最小、および全滅回数が表示されます。全滅を避けたい場合にご活用ください。"
			},
			{
				type: 0, title: "一部艦載機に対空射撃回避補正を適用しました。",
				content: "対空砲火による撃墜機能実装に伴う追加です。主にネームド機や強めの瑞雲系が該当します。前述の全滅率表示機能と併せると効果が分かりやすいです。"
			},
			{
				type: 0, title: "入力情報コピペテキストを用意しました。",
				content: "入力情報欄下部に増設されています。掲示板など画像が貼りにくいような環境に書き込む際などにご利用ください。"
			},
			{
				type: 1, title: "敵艦データを更新しました。",
				content: "対空砲火による撃墜機能追加に伴い、駆逐艦などの非偵察機搭載艦などを追加しました。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "2019秋イベ E-6 [丁] の敵編成が表示されない不具合を修正しました。"
			},
		],
	},
	{
		id: "1.4.1", changes: [
			{
				type: 0, title: "計算結果のスクショをワンボタンで保存できるようになりました。",
				content: "計算結果欄のカメラのアイコンをクリックすると、クリックした時点の計算結果欄を画像化し、お使いの端末に保存します。"
			},
			{
				type: 0, title: "Twitterでつぶやく機能を追加しました。",
				content: "押した時点での編成URLがあらかじめ入力されたツイート画面に移動します。"
			},
			{
				type: 0, title: "計算結果欄の表示を微妙にカスタマイズできるようになりました。",
				content: "結果グラフと表をドラッグ&amp;ドロップで入れ替えられるようになりました。また、基地や本隊を指定して非表示にできるようになりました。"
			},
			{
				type: 0, title: "機体配置時の初期熟練度を調整できるようになりました。",
				content: "詳細設定欄から変更可能です。カテゴリ毎に、新たに機体を配置した際の熟練度を変更することが可能です。選択値は次回サイト訪問時に復元します。"
			},
			{
				type: 1, title: "手動計算開始機能を廃止しました。",
				content: "あまりにも空気機能でした。どうしても復活を希望する方がいればご一報ください。"
			},
		],
	},
	{
		id: "1.4.2", changes: [
			{
				type: 0, title: "海域マップ画像の各戦闘マスがクリックできるようになりました。",
				content: "画像内の戦闘マスをクリックすると、そのマスの敵編成を表示できます。従来通りマス一覧から選択することも可能です。"
			},
			{
				type: 0, title: "入力情報のスクショをワンボタンで保存できるようになりました。",
				content: "入力情報のカメラのアイコンをクリックすると、クリックした時点の入力情報を画像化し、お使いの端末に保存します。"
			},
			{
				type: 1, title: "計算結果欄の表示のカスタマイズ方法を変更しました。",
				content: "スマホ閲覧時に入れ替えが誤爆してしまう対策としてドラッグ開始可能範囲を限定、グラフの表示、非表示をトグル式で変更するようにしました。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "陸上偵察機補正が動かなくなっていた不具合を修正しました。"
			},
		],
	},
	{
		id: "1.4.3", changes: [
			{
				type: 0, title: "基地、艦娘のドラッグ&amp;ドロップによる交換機能を追加しました。",
				content: "ゲーム内編成画面のように、艦娘の画像をドラッグ&amp;ドロップすることで交換可能です。基地については「第X基地航空隊」の表示部分から交換可能です。"
			},
			{
				type: 0, title: "味方の連合艦隊、通常艦隊を切り替えられるようになりました。",
				content: "自艦隊欄「連合艦隊」チェックで変更できます。非チェック状態の場合、表示されている艦隊のみ計算対象になります。"
			},
			{
				type: 0, title: "本隊航空戦stage1直後の敵艦載機数表示を追加しました。",
				content: "計算結果欄最下部に表示されます。味方艦隊の対空砲火前の搭載数であることに注意してください。表示 / 非表示を選択可能です。"
			},
			{
				type: 0, title: "入力した艦娘の有効、無効を選択できるようになりました。",
				content: "「無効」とした艦は、入力内容はそのままですが計算対象になりません。該当の艦娘を艦隊に入れるか入れないか調整する際にお役立てください。無効状態でも装備換装等は通常通り可能です。"
			},
			{
				type: 0, title: "基地空襲をワンクリックで起こせるようになりました。",
				content: "基地航空隊欄の右上部にあるボタンから、空襲時の被害を各航空隊の最上部スロに対してランダムに発生させます。その隣のボタンから補給も可能です。"
			},
			{
				type: 0, title: "艦娘選択欄、および自艦隊欄に画像を追加しました。",
				content: ""
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "特定条件で試製景雲を他の艦に装備できる不具合を修正しました。"
			},
		],
	},
	{
		id: "1.5.0", changes: [
			{
				type: 0, title: "所持装備数入力機能を追加しました。",
				content: "サイト下部「所持艦娘 / 装備」欄から入力可能です。特に入力しなくても本サイトは従来通り利用可能ですが、自分がゲームで所持している機体に合わせて所持数を入力すると、後述する新機能をより便利に活用できます。"
			},
			{
				type: 0, title: "所持機体から機体を選択する機能を追加しました。",
				content: "「所持艦娘 / 装備」で設定した機体のみ選択できる機能です。改修値が設定されている場合、改修値が多いものから順に配備します。なお、保存した編成の読み込みや、プリセット展開などは、所持機体に関わらず従来通り利用可能です。"
			},
			{
				type: 0, title: "艦載機のおまかせ自動配備機能(仮)を実装しました。",
				content: "「所持艦娘 / 装備」で設定した機体から艦載機を一気に自動で配備してくれる機能です。現段階では単純なアルゴリズムで配備を行うため、必ずしも最適な配置になるとは限りません。制空調整初期のたたき台などに利用してみてください。"
			},
			{
				type: 0, title: "各種一覧画面に、名称検索フォームを設置しました。",
				content: "装備、艦娘、敵艦の一覧画面に設置されています。入力文字列に部分一致したデータを表示します。"
			},
			{
				type: 1, title: "海域マップ選択画面の表示形式を変更しました。",
				content: "パターン毎に分かれていたマスを統一し、マス選択後にさらに編成を選択するように変更しました。また、通常海域の敵編成パターンをある程度追加しました。"
			},
			{
				type: 1, title: "UI / レイアウトの調整を行いました。",
				content: "とにかくいろいろ"
			},
		],
	},
	{
		id: "1.5.1", changes: [
			{
				type: 0, title: "ミニ期間限定イベント対応",
				content: "確認できた敵編成から順次追加しています。今後、強編成等が確認された場合は編成が変わる可能性があります。"
			},
			{
				type: 0, title: "おまかせ配備上書き回避機能を追加しました。",
				content: "各艦娘スロットの錠前アイコンから、そのスロットのおまかせ配備による上書きを回避できる機能です。主砲や缶用の空きスロットや、彩雲や夜間攻撃機などを指定艦に固定しておきたい場合にご利用ください。"
			},
			{
				type: 1, title: "おまかせ配備機能から、一部オプションを削除しました。",
				content: "重巡系の水戦ガン積み化を回避するオプションですが、上記ロック機能の実装により廃止になりました。"
			},
		],
	},
	{
		id: "1.5.2", changes: [
			{
				type: 0, title: "スクリーンショット機能を全ての入力欄に追加しました。",
				content: "各入力欄右上部の<i class='px-1 fas fa-camera'></i>を押下すると、その欄のスクリーンショットを保存し、お使いの端末にダウンロードします。SNSでの共有、備忘録等にご利用ください。"
			},
			{
				type: 0, title: "ミニ期間限定イベント対応",
				content: "確認できた敵編成から順次追加しています。今後、強編成等が確認された場合は編成が変わる可能性があります。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "オートセーブ時、特定条件でスロット位置がずれる不具合を修正しました。"
			},
		],
	},
	{
		id: "1.5.3", changes: [
			{
				type: 0, title: "機体選択画面内の機体一覧ソート機能を強化改修しました。",
				content: "出撃時の対空値、防空時の対空値などでソートできるようになりました。ソート条件は保存され、次回サイト訪問時に復帰します。"
			},
			{
				type: 0, title: "海域選択画面にて、陣形、敵艦隊防空値の表示を追加しました。",
				content: ""
			},
			{
				type: 1, title: "基地空襲発生ボタンによる被害を4機固定に変更しました。",
				content: "「詳細設定」欄から、該当のオプションのON/OFFを切り替えられます。OFFにすると、従来のように1～4機のランダム被害を発生させます。"
			},
			{
				type: 2, title: "表示・レイアウトの修正を行いました。",
				content: "特定の環境において、想定していない描画がなされているケースがありましたので対策を入れました。また、一部表記揺れのあった文言を修正しました。"
			},
		],
	},
	{
		id: "1.5.4", changes: [
			{
				type: 2, title: "敵艦の対空性能を修正しました。",
				content: "全滅率や制空調整に大きく関わるため急遽修正しました。申し訳ありませんでした。2020/3/13以前に作成した編成がある場合、今一度計算結果をご確認ください。"
			},
		],
	},
	{
		id: "1.5.5", changes: [
			{
				type: 0, title: "編成のバックアップ機能を追加しました。",
				content: "誤って艦隊をリセットしたり他のURLを読み込んで上書きされた際、編成を復元できる機能です。「編成保存・展開」からバックアップの確認や展開が可能です。保存件数や機能の停止などは「詳細設定」から行ってください。"
			},
			{
				type: 0, title: "使い方、初めての方への案内、よくある質問を追加しました。",
				content: "あれ？と思ったらまずは「初めての方へ」や「よくある質問」などを見て下さい。"
			},
			{
				type: 1, title: "出撃時対空、防空時対空ソート時の対空値の表記を変更しました。",
				content: "機体一覧において、従来は装備の素対空値を表示していましたが、ソート条件を前述の2つにした場合、それぞれ実際の出撃時対空値、防空時対空値を表示するように変更しました。"
			},
			{
				type: 1, title: "連合艦隊のチェック状態を保持するようにしました。",
				content: ""
			},
		],
	},
	{
		id: "1.5.6", changes: [
			{
				type: 0, title: "海域一括入力機能を追加しました。",
				content: "1戦目から順に連続で敵艦隊を入力できる機能です。戦闘数を事前に把握しておく必要がなくなりました。「敵艦隊」欄からご利用ください。"
			},
			{
				type: 1, title: "艦隊欄のリセットボタンのUIを変更しました。",
				content: "ゴミ箱アイコンです。従来の装備一括解除ボタンは、ゲーム同様のUIに倣っています"
			},
			{
				type: 1, title: "艦娘の無効化状態を保持するように変更しました。",
				content: ""
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "結果表示欄において、非表示にした表示物が再度表示されてしまう現象を修正しました。"
			},
		],
	},
	{
		id: "1.6.0", changes: [
			{
				type: 0, title: "搭載数詳細計算機能(艦娘)を追加しました。",
				content: "出撃終了時点での艦娘の各搭載数の分布を詳細に表示できるようになりました。「計算結果」欄から、見たい機体をクリックすると表示されます。"
			},
			{
				type: 0, title: "搭載数詳細計算機能(敵艦)を追加しました。",
				content: "本隊航空戦終了後の敵艦載機の残数や、その航空戦火力の詳細表示が可能になりました。対空装備をどの程度積むのかの参考にしてください。"
			},
			{
				type: 0, title: "海域一覧画面でのダブルクリックに対応しました。",
				content: "戦闘マスや編成パターン名をダブルクリックすることでも敵艦を展開できるようになりました。パターンが複数あるマスの誤展開には注意してください。"
			},
			{
				type: 0, title: "「よく使う」順でソートできるようになりました。",
				content: "装備一覧、艦娘一覧の表示順を、自身がよく選択する順でソートできるようになりました。詳細設定から学習した情報のリセットも可能です。"
			},
			{
				type: 0, title: "背景色を自由に変更できるようにしました。",
				content: "「詳細設定」欄から変更できます。いつもと違う気分で計算したい方に。"
			},
			{
				type: 0, title: "新装備を追加しました。",
				content: "新型のSwordfish系列、Fairey Seafox改を追加しました。"
			},
			{
				type: 1, title: "よくある質問を更新しました。",
				content: ""
			},
		],
	},
	{
		id: "1.6.1", changes: [
			{
				type: 0, title: "搭載数詳細計算機能(基地)を追加しました。",
				content: "基地航空隊の被撃墜数の詳細表示が可能になりました。計算結果欄の基地の制空結果欄をクリックすると表示します。"
			},
			{
				type: 0, title: "各大見出しの入れ替え状況を保存するようにしました。",
				content: "順序入れ替え終了ボタンを押した時点での順序が保持されます。"
			},
			{
				type: 1, title: "搭載数詳細計算画面のUIを変更しました。",
				content: "画面を開いたまま別の装備の詳細を表示できるようになりました。別の搭載艦を見たい場合は今まで通り一度閉じてください。"
			},
		],
	},
	{
		id: "1.6.1.1", changes: [
			{
				type: 1, title: "機体ソート項目に「基地攻撃時の火力順」を追加しました。",
				content: "対水上艦への攻撃の場合で、陸攻特効等の補正は考慮していません。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "基地詳細計算時、偵察機系の機体が航空戦stage1の撃墜対象外だった問題、陸攻の改修値が航空戦火力に適用されていなかった問題を修正しました。"
			},
		],
	},
	{
		id: "1.6.2", changes: [
			{
				type: 0, title: "敵艦隊の対空砲火計算機能を追加しました。",
				content: "入力した敵艦隊毎に、敵艦それぞれの割合、固定撃墜数などを一覧で表示します。同画面内にて簡易的な撃墜数の試算も可能です。敵艦隊欄の <i class='fas fa-exclamation-circle text-primary'></i> アイコンをクリックすると起動します。"
			},
			{
				type: 1, title: "共有URL発行時のURLを短縮化するように変更しました。",
				content: ""
			},
			{
				type: 0, title: "新装備を追加しました。",
				content: "天山一二型甲改2種、XF5Uを追加しました。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "敵艦隊未設定時に計算結果欄の表示が意図していない表示になっていた現象を修正しました。神州丸改に水上爆撃機が搭載できない件を修正しました。"
			},
		],
	},
	{
		id: "1.7.0", changes: [
			{
				type: 0, title: "噴式強襲航空攻撃による撃墜を実装しました。",
				content: "内部的な処理の追加ですので、今までと特に入力方法を変更する必要はありません。なお、計算結果欄の各戦闘毎の表示に関して、搭載数については<span class='font-weight-bold'>噴式強襲前</span>の搭載数、制空値(自艦隊)については<span class='font-weight-bold'>噴式強襲後</span>の制空値が表示されています。"
			},
			{
				type: 0, title: "噴式爆撃機の通常航空戦Stage1撃墜軽減処理を追加しました。",
				content: ""
			},
			{
				type: 0, title: "敵艦隊欄の敵艦を画像表示できるようになりました。",
				content: "従来通りの敵艦名称表示と、画像表示とで切り替えられます。お好きな方をご利用ください。"
			},
			{
				type: 1, title: "敵側の撃墜処理を微修正しました。",
				content: ""
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "改修不可で、かつ★付きの装備の改修値が変更できない問題を修正しました。一部艦爆の改修効果が間違っていた箇所を修正しました。"
			},
		],
	},
	{
		id: "1.7.1", changes: [
			{
				type: 0, title: "ダークテーマβを導入しました。",
				content: "「詳細設定」欄の最下部にて変更できます。試験的な導入のため、表示がおかしい箇所が出ているかもしれません。お気づきの点がありましたらご報告ください。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "長門改に水上戦闘機が装備できない状態になっていた問題を修正しました。"
			},
		],
	},
	{
		id: "1.7.2", changes: [
			{
				type: 0, title: "元に戻す(Undo)、やり直す(Redo)機能を追加しました。",
				content: "「Ctrl + Z」「Ctrl + Y」を押下してください。"
			},
			{
				type: 0, title: "テーマ『深海』を導入しました。",
				content: "赤くはないです。例によって、「詳細設定」欄の最下部にて変更可能です。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "敵艦の制空値直接入力時、および艦載機熟練度変更時の挙動がおかしい不具合を修正しました。"
			},
		],
	},
	{
		id: "1.7.3", changes: [
			{
				type: 0, title: "機体のお気に入り機能を追加しました。",
				content: "お気に入りに登録した機体のみを一覧から選択できるようになりました。「所持艦娘 / 装備欄」で機体のお気に入り登録が可能です。機体一覧にて「お気に入りのみ」モードが実装されておりますので、そちらをクリックしご活用ください。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "初期表示時にテーマが固定されてしまう不具合、特定条件で艦娘無効機能が別の艦娘に対して動作してしまう不具合を修正しました。"
			},
		],
	},
	{
		id: "1.7.3.1", changes: [
			{
				type: 1, title: "詳細計算画面のレイアウトを微妙に変更しました。",
				content: "そのうちまた変わります。"
			},
			{
				type: 2, title: "軽微な不具合の修正を行いました。",
				content: "基地航空隊のラベルが全て第1基地航空隊になっていた問題を修正しました。"
			},
		],
	},
	{
		id: "1.7.4", changes: [
			{
				type: 0, title: "敵艦隊の航空戦前後の制空値分布表示機能を追加しました。",
				content: "計算結果欄最下部に増設しました。航空戦後の値は、主に航空支援時の制空値調整に利用可能です。"
			},
			{
				type: 1, title: "サイト表示速度の改善を行いました。",
				content: "いろいろ施しました。スマホ閲覧時はやはり重い模様。また、Loading画面は撤廃しました。"
			},
			{
				type: 1, title: "バージョン変更内容を任意で表示するようにしました。",
				content: "この文言を表示できたということは、変更内容の表示方法の解説は不要ですね！"
			},
		],
	},
	{
		id: "1.7.5", changes: [
			{
				type: 0, title: "基地 & 艦隊入力欄下部に、制空状態ゲージを追加しました。",
				content: "計算結果欄にて表示されている基地と艦隊の制空状態ゲージを、スクロールせずに確認できます。なお、基地は第1波の制空状態が表示されています。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "高高度空襲計算時、すべての基地航空隊を外した際、最後の制空値が削除されずゾンビ化して計算される不具合を修正しました。"
			},
		],
	},
	{
		id: "1.7.6", changes: [
			{
				type: 0, title: "ドラッグ & ドロップ可能な機体一覧画面を追加しました。",
				content: "基地航空隊欄または艦隊欄の <i class='fas fa-list-ul'></i> ボタンから起動します。表示されている機体をドラッグ & ドロップで装備させることができます。また、この画面自体も自由に動かせます。"
			},
		],
	},
	{
		id: "1.7.6.1", changes: [
			{
				type: 1, title: "淡色系のテーマを2種追加しました。テーマ案まだまだ募集中です",
				content: "「空(Sky)」と「桜」の2種です。単なる背景色の変更だけかとか言わない。また、テーマ変更時の処理の最適化を行いました。その関係で、v1.7.6以前適用していたテーマはリセットされています。お手数ですが再度変更してください。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "特定条件で、艦娘の搭載数を初期値に戻す際、0機になる不具合を修正しました。"
			},
		],
	},
	{
		id: "1.7.7", changes: [
			{
				type: 0, title: "味方艦隊の触接率の計算及び表示を追加しました。",
				content: "自艦隊欄の、艦隊制空値の隣に追加されています。詳細アイコン<i class='fas fa-search'></i>をクリックするとより詳しい触接率を表示します。"
			},
			{
				type: 1, title: "一部UIデザインを調整しました。",
				content: ""
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "特定条件で、自動保存されたデータが復帰できず消えてしまう不具合を修正しました。スクリーンショットボタンクリック時に背景色がおかしくなる現象を修正しました。"
			},
		],
	},
	{
		id: "1.7.8", changes: [
			{
				type: 0, title: "基地航空隊の触接率の計算が可能になりました。",
				content: "基地航空隊の、触接詳細アイコン<i class='fas fa-search'></i>をクリックすると、各制空状態下での触接率を表示します。"
			},
			{
				type: 0, title: "2020梅雨イベント 対応",
				content: "確認できた敵編成から順次追加していきます。今後、強編成等が確認された場合は編成が変わる可能性があります。"
			},
		],
	},
	{
		id: "1.7.9", changes: [
			{
				type: 0, title: "編成プリセットの順の変更が可能になりました。",
				content: "編成プリセットの、連番が振られている箇所をドラッグ & ドロップすることで、プリセットの順番を変更できます。"
			},
			{
				type: 0, title: "コメント欄を開設しました。",
				content: "サイト下部にて、バグ報告、要望、情報提供、質問、感想など自由に書き込めるコメント欄が新設されています。気軽にご利用ください。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "基地航空隊をドラッグ & ドロップで入れ替えた際に、ゲージの表示や触接率がおかしくなる現象を修正しました。スクリーンショット時に文字がずれる場合がある問題を修正しました。"
			},
		],
	},
	{
		id: "1.7.10", changes: [
			{
				type: 0, title: "装備機体情報をポップアップで表示できるようになりました。",
				content: "装備されている機体の艦載機カテゴリアイコン上にマウスを乗せることで表示を行います。各装備毎の制空値もここから参照できます。"
			},
			{
				type: 1, title: "語弊があると思われるボタンの名称を変更を行いました。",
				content: "その他、名称と想定の動きが食い違う点などありましたらご報告ください。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "彩雲(偵四)の命中が0で計算されていた不具合を修正しました。敵制空値を直接入力した際に反映されない場合がある不具合を修正しました。"
			},
		],
	},
	{
		id: "1.8.0", changes: [
			{
				type: 0, title: "所持艦娘入力機能を追加しました。",
				content: "サイト下部「所持艦娘 / 装備」欄から入力可能です。特に入力しなくても本サイトは従来通り利用可能ですが、自分がゲームで所持している艦娘に合わせて所持数を入力するとより便利にサイトを活用できます。"
			},
			{
				type: 0, title: "所持艦娘から艦娘を選択する機能を追加しました。",
				content: "「所持艦娘 / 装備」で設定した艦娘のみ選択できる機能です。なお、保存した編成の読み込みや、プリセット展開などは、所持数に関わらず従来通り利用可能です。"
			},
			{
				type: 0, title: "艦娘のお気に入り機能を追加しました。",
				content: "お気に入りに登録した艦娘のみを一覧から選択できるようになりました。「所持艦娘 / 装備」欄で機体のお気に入り登録が可能です。艦娘一覧にて「お気に入りのみ」が実装されておりますので、そちらをクリックしご活用ください。"
			},
			{
				type: 0, title: "敵艦載機情報をポップアップで表示できるようになりました。",
				content: "「計算結果」欄の敵艦隊の搭載数にて、機体アイコン上にマウスを乗せることで表示を行います。"
			},
			{
				type: 1, title: "一部UIの見直しを行いました。",
				content: ""
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "艦娘未指定時に、艦載機が全て選択できない場合がある現象を修正しました。"
			},
		],
	},
	{
		id: "1.8.1", changes: [
			{
				type: 0, title: "防空（重爆）時の補正値の表示を追加しました。",
				content: "防空計算時かつ敵艦隊に重爆空襲を指定した際に、防空時制空値にかかる補正値が表示されるようになっています。"
			},
			{
				type: 1, title: "陸上偵察機の改修に対応しました。",
				content: "現在確認されている、二式陸上偵察機(熟練)★2を搭載した際に制空値を+1する処理を暫定的に追加しました。"
			},
		],
	},
	{
		id: "1.8.2", changes: [
			{
				type: 0, title: "艦載機一覧にフィルタを追加しました。",
				content: "半径や対空値などで足切りできます。一覧画面にて、絞りたい項目と絞りたい値を設定してください。"
			},
			{
				type: 1, title: "艦載機カテゴリ絞り込み方法を変更しました。",
				content: "機体一覧画面について、艦載機アイコンから、ワンクリックでカテゴリを絞り込めるようになりました。"
			},
			{
				type: 0, title: "銀河(江草隊)を追加しました。",
				content: ""
			},
		],
	},
	{
		id: "1.8.2.1", changes: [
			{
				type: 0, title: "ヘッダー左上部に、展開した編成名の表示を追加しました。",
				content: "ある程度画面の大きさがないと表示が省略されます。編成の展開後、何らかの変更を行うと「*」印が付加されますので、保存したか分からなくなった場合等にご覧ください。"
			},
		],
	},
	{
		id: "1.9.0", changes: [
			{
				type: 0, title: "味方艦隊の対空砲火性能を設定できるようになりました。",
				content: "「対空砲火設定」ボタンから、艦隊防空値、加重対空値、対空CI種別等を設定可能です。ただし、本サイトでは全ての艦娘や装備データを扱っていないため、これらの値は外部編成サイト等で計算するか、自分で計算した値を入力していく形式になります。"
			},
			{
				type: 0, title: "敵艦載機に対する対空砲火シミュレーションが可能になりました。",
				content: "上記「対空砲火設定」を行うと、計算結果欄の敵艦隊の搭載数の数値が、対空砲火計算処理を行った後の数値に置き換わります。計算結果欄の「対空砲火無視」にチェックを入れると、対空砲火計算を無視し、従来通りの表示も可能です。"
			},
			{
				type: 0, title: "敵艦の棒立ち率の算出が可能になりました。",
				content: "上記「対空砲火設定」を行うと、敵の「攻撃機」が全て0機になる確率、つまり棒立ち率を算出します。なお厳密には敵艦が空母系でない場合、普通に砲撃してくるので棒立ちにはなりません。"
			},
			{
				type: 0, title: "所持装備を、ゲーム同様に個別表示できるようになりました。",
				content: "複数所持している装備も1つ1つ個別に表示します。これにより、所持している同じ装備で改修値の違う装備を自由に配備できるようになります。また、対空値ソート時は改修効果を反映してソートされます。"
			},
			{
				type: 1, title: "プリセット保存できる要素に、対空砲火性能設定を追加しました。",
				content: "プリセット保存した時点での入力した対空砲火設定も一緒に保存されます。本アップデート以前に作成されたプリセットについては、対空砲火性能は未入力状態となっていますので注意してください。"
			},
		],
	},
	{
		id: "1.9.0.1", changes: [
			{
				type: 1, title: "艦隊防空値の入力形式を変更しました。",
				content: "基準(単縦や第四)の艦隊防空値を入力し、各陣形補正値を掛けて艦隊防空値を算出できます。ただし、この方法での算出方法は簡易的なものです。より厳密な値で計算したい場合は直接入力も可能です。"
			},
		],
	},
	{
		id: "1.9.0.2", changes: [
			{
				type: 1, title: "零式水上偵察機11型乙(熟練)の改修に対応しました。",
				content: ""
			},
			{
				type: 1, title: "一括設定時の挙動を変更しました。",
				content: "陸上偵察機の熟練度が||を超えないようにしました"
			},
			{
				type: 2, title: "細かい修正を行いました。",
				content: "デッキビルダー形式読み込みの処理を修正しました。また、デフォルトで内部熟練度を120にする機体をやめ、すべての機体をデフォルトでは内部熟練度100で計算するようにしました。"
			},
		],
	},
	{
		id: "1.9.0.3", changes: [
			{
				type: 0, title: "基地航空隊の残機数分布データ出力機能を追加しました。",
				content: "基地航空隊の残機数詳細画面に設置されたボタンから、搭載数の分布データをJSON形式で出力し、クリップボードにコピーを行います。フォーマットは説明不要な単純なものです。取り扱い方がわかる方はご利用ください。"
			},
		],
	},
	{
		id: "1.9.1.0", changes: [
			{
				type: 0, title: "対空砲火設定にて、対空CIの詳細な設定が可能になりました。",
				content: "複数の対空CIを設定できるようになりました。対空CI毎の発動率を入力することで、より実戦に近い敵機撃墜計算が可能になります。例によって、対空CIの発動率等はお手数ですが外部サイト等にて計算を行い入力をお願いします。"
			},
			{
				type: 2, title: "細かい修正を行いました。",
				content: "SBD、一式陸攻 二二型甲の改修に対応しました。また、Skuaの改修効果が間違っていたため修正しました。"
			},
		],
	},
	{
		id: "1.9.1.1", changes: [
			{
				type: 1, title: "艦娘データの整備を行いました。",
				content: "今後の保守のため、艦娘データ構造の見直しを行いました。それに伴い、一部艦娘一覧の順番が変更されました。"
			},
			{
				type: 1, title: "デッキビルダー形式にて取込み可能な艦娘の数を拡張しました。",
				content: "外部サイト、ツール等からデッキビルダー形式を介して本サイトに編成を取り込んだ際、搭載数が存在する艦娘は全て読み込めるようになりました。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "艦娘の所持情報が登録されている状態において、艦娘を選択した後、その艦娘を別の艦娘と入れ替えた際に所持数が戻らなくなる現象を修正しました。"
			},
		],
	},
	{
		id: "1.9.2", changes: [
			{
				type: 0, title: "水上偵察機のみ搭載可能な艦娘を選択できるようになりました。",
				content: "スクロール領域の肥大化を避けるため、艦娘選択画面内で「何らかの艦種を選択した場合」のみ表示されます。もちろん、編成保存や復帰は通常の艦娘と同様に可能です。"
			},
			{
				type: 0, title: "残機数分布データ出力機能を拡張しました。",
				content: "基地航空隊のほか、艦娘及び敵艦の残機数分布のクリップボードへのコピーも可能になりました。操作手順は同様です。"
			},
			{
				type: 1, title: "レイアウトの修正を行いました。",
				content: ""
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "0機スロットを持つ艦娘を選択した際に、0機スロットが表示されない現象を修正しました。"
			},
		],
	},
	{
		id: "1.9.2.1", changes: [
			{
				type: 0, title: "機体選択欄のソート、フィルタの復帰機能を追加しました。",
				content: "ついでに、基地航空隊と艦娘の機体選択画面のソート、フィルタ条件を独立させました。"
			},
			{
				type: 1, title: "敵編成を大幅に追加し、編成パターンの表示順を変更しました。",
				content: "表示順については、そのマス内で出てくる編成のうち、最も制空値が高い編成をトップに表示するように統一しました。編成パターンの入力間違いにご注意ください。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "阿武隈改二、青葉改、愛宕改、高雄改が最終状態にチェックを入れても表示されない現象を修正しました。"
			},
		],
	},
	{
		id: "1.9.2.2", changes: [
			{
				type: 0, title: "新海域に対応しました。",
				content: "南西海域 ペナン島沖（7-3）を追加しました。"
			},
			{
				type: 1, title: "レイアウトの調整を行いました。",
				content: "横幅が1200pxを超えるようなワイド画面での閲覧時の表示を調整しました。元の表示に戻す場合は、画面右上の「縮小表示」にチェックを入れてください。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "特定条件下で、潜水マスで噴式強襲計算が行われるようになっていた不具合を修正しました。"
			},
		],
	},
	{
		id: "1.9.2.3", changes: [
			{
				type: 0, title: "噴式爆撃機配備時の鋼材消費量の表示を追加しました。",
				content: "計算結果画面の、ボーキサイト消費量が表示されていた箇所に追加されます。設定した一連の戦闘で鋼材消費が発生しない場合、この表示は行われません。また、配備した噴式爆撃機にマウスカーソルを置くと表示される情報にも鋼材の消費量が表示されます。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "スクリーンショット撮影ボタン押下時の挙動で一部想定していない挙動がありましたので修正しました。"
			},
			{
				type: 0, title: "データの更新を行いました。",
				content: "99艦爆22型、同熟練の追加を行いました。また、改修可能装備の追加を行いました。"
			},
		],
	},
	{
		id: "1.10.0", changes: [
			{
				type: 0, title: "サイト構造を刷新しました。",
				content: "サイト構造の変更、レイアウトの修正を全体的に行いました。直感的に分かるよう考慮しましたが、もし操作方法等がよく分からなくなった場合は気軽に質問してください。"
			},
			{
				type: 0, title: "編成タブ機能を追加しました。",
				content: "タブ化した編成をワンクリックで切り替えられるようになりました。まずは一覧画面から編成を選択してください。一覧画面とは、常にページ最左上のボタンから遷移できるページです。"
			},
			{
				type: 0, title: "編成共有ボタンを新設しました。",
				content: "従来の「編成保存」ボタンで行っていたデッキビルダー形式や編成URLの作成はこちらのボタンからアクセスできます。これに伴い、「編成保存」ボタン内の処理を見直し、こちらは文字通り編成保存のみを行うよう変更しました。"
			},
			{
				type: 0, title: "作戦室 Jervis orへの編成展開機能を実装しました。",
				content: "ページ上部に新設された「編成共有」ボタン内に、作成した編成を艦隊編成サイト「作戦室 Jervis or」様へ展開できる機能を追加しました。"
			},
			{
				type: 0, title: "味方艦隊制空値の内訳の表示を追加しました。",
				content: "各艦娘毎の制空値横に、スロット順の制空値を表示するようにしました。"
			},
			{
				type: 1, title: "編成保存ボタンの挙動を変更しました。",
				content: "「開いているタブ」に対し上書き保存するように変更されました。未保存のタブは名前を付けて保存する画面を表示します。"
			},
		],
	},
	{
		id: "1.10.1", changes: [
			{
				type: 0, title: "編成タブ欄に、新規タブ追加ボタンを設置しました。",
				content: "ただちに新しい編成を開けるボタンを追加しました。編成一覧画面にて「新規作成」を押した時と同様、編成情報がすべて未入力の「無題」タブを開きます。"
			},
			{
				type: 0, title: "タブの別名保存機能を追加しました。",
				content: "画面上部に、現在開いている編成を別名で保存できるボタンを追加しました。"
			},
			{
				type: 0, title: "ホイールクリックでタブを閉じられる機能を追加しました。",
				content: "閉じたいタブの上にカーソルを持っていき、マウスホイールをクリックすると該当のタブを閉じられます。ホイールクリックやマウス自体がない環境は未対応です。"
			},
			{
				type: 0, title: "基地航空隊制空値の内訳の表示を追加しました。",
				content: "陸上偵察機等の配備時はその補正値も表示されます。また、防空計算時の表示も変更し、欄内上部にて防空札に設定されている部隊の制空値合計と対重爆時の数値、補正値を表示するようにしました。基地資源消費は各航空隊欄の&#9660;ボタンをクリックすると見らます。"
			},
			{
				type: 0, title: "機体プリセット機能を拡張し、改修値の保存に対応しました。",
				content: "保存時に入力されていた機体の改修値も保存、復帰ができるようになりました。この機能で呼び出した装備は登録装備の上限を超えて展開される場合があります。"
			},
			{
				type: 1, title: "新規タブ生成時、「無題」に連番を振るように変更しました。",
				content: "仕様上、同じ編成名のタブを大量に作成することも可能ですがなんとなく連番を振るように変更しました。"
			},
		],
	},
	{
		id: "1.10.1.1", changes: [
			{
				type: 0, title: "新カテゴリを追加しました。",
				content: "深山、深山改が属する「大型陸上機」を追加しました。ただし、いったん基地航空隊の選択時は陸上攻撃機カテゴリに配置しています。"
			},
			{
				type: 0, title: "新装備を追加しました。",
				content: "深山、深山改を追加しました。"
			},
		],
	},
	{
		id: "1.10.2", changes: [
			{
				type: 0, title: "編成データのソート機能を追加しました。",
				content: "更新日時順、名前順、ユーザー指定で指定できます。ユーザー指定時は自由に順序を入れ替えられます。"
			},
			{
				type: 0, title: "編成データの名称検索機能を追加しました。",
				content: "検索窓に入力された文字に部分一致する編成データのみ表示できるようになりました。なお、検索機能が有効になっている間は、編成データの順序変更はできません。"
			},
			{
				type: 0, title: "編成データ一覧に更新日時の表示を追加しました。",
				content: "前述したソート機能のうち、更新日時はこの値を用いてソートします。いままで保持してこなかったデータのため、既に作成されている編成データはバージョン「1.10.2」適用時点の日付が登録されています。ご了承ください。"
			},
			{
				type: 1, title: "編成データの順序入れ替え機能制限のお知らせ",
				content: "ソート順が「ユーザー指定」かつ、検索窓になにも入力されていない状態でのみ、各編成データのドラッグ&ドロップによる入れ替えができるように制限が入りました。また、誤操作を防ぐため編成データ枠右上の三角マークからのみ順序変更できるように制限しました。ご注意ください。"
			},
		],
	},
	{
		id: "1.10.2.1", changes: [
			{
				type: 1, title: "機体選択欄の表示処理を変更しました。",
				content: "いままでは「個別表示」を押すと、登録した装備がナイーブに出力されていましたが、同じ改修値の装備はまとめて表示するようにしました。また、この変更にあたり、「個別表示」の文言を「<i class='fas fa-star remodel_label'></i>反映」に変更しました。"
			},
			{
				type: 2, title: "レイアウトの一部修正を行いました。",
				content: "一部環境で、大画面表示時に一覧画面が想定通り表示できていなかった現象を確認したため、対策を入れました。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "タブを閉じた際、特定条件下で変なタブが生成される現象の修正を行いました。"
			},
		],
	},
	{
		id: "1.10.2.2", changes: [
			{
				type: 1, title: "敵編成展開画面での並び順を更新しました。",
				content: "敵制空値が同じである場合は、対空砲火のキツい編成が優先して手前に来るようにしました。並び順がおかしい場合はご一報ください。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "深山系の配備コストを修正しました。"
			},
		],
	},
	{
		id: "1.10.3", changes: [
			{
				type: 0, title: "編成のアップロード機能を試験実装しました。",
				content: "編成を新規、または別名保存する際、その編成をアップロードできる機能を追加しました。アップロードした編成は他の人が誰でも閲覧できる状態となります。"
			},
			{
				type: 0, title: "みんなの編成検索機能を試験実装しました。",
				content: "編成データ一覧画面にて「みんなの編成」タブを追加しました。上記アップロード機能によりアップロードされた編成を海域、難易度毎に検索、閲覧できます。"
			},
			{
				type: 0, title: "みんなの編成展開機能を試験実装しました。",
				content: "検索結果の編成をクリックすると、その編成をベースに新たな編成を作成できます。ベースとなった編成自体は変更されないため、そこから編成をさらに組み替えたりして問題ありません。なお、本機能を含め編成アップロード機能関連は試験実装です。何らかの問題があった場合は予告なく機能の変更、削除を行う可能性があります。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "コメントが投降できない状態になっていた現象を修正しました。"
			},
		],
	},
	{
		id: "1.10.4", changes: [
			{
				type: 0, title: "新規敵艦の装備手動設定機能を追加しました。",
				content: "イベント開始時など、敵艦の制空値が本シミュレータ上で未確定である敵艦の装備を手動で設定できるようになりました。計算画面最下部「敵艦管理」欄にて設定可能です。シミュレータ側で敵制空値が確定次第、設定は無効になります。"
			},
			{
				type: 0, title: "みんなの編成にて海域混合での検索を追加しました。",
				content: "海域毎の区別なく、最新の20件を表示します。上から新しい順固定です。"
			},
			{
				type: 1, title: "敵艦直接入力機能を廃止しました。",
				content: "装備手動設定機能の追加と、バグの温床になっていたため本機能は廃止されました。"
			},
		],
	},
	{
		id: "1.10.4.1", changes: [
			{
				type: 0, title: "2020秋イベント 対応",
				content: "確認できた敵編成から順次追加していきます。今後、強編成等が確認された場合は編成が変わる可能性があります。"
			},
			{
				type: 1, title: "海域選択時の半径を保存できるようにしました。",
				content: "忘れてたわけではないです。忘れてたわけではないです。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "軽巡ヘ級改、駆逐イ級後期型eliteの対空性能を修正しました。対空値3以上の艦爆を基地航空隊に配備するとおかしくなる件を修正しました。"
			},
		],
	},
	{
		id: "1.10.4.2", changes: [
			{
				type: 0, title: "2020秋イベント 対応",
				content: "確認できた敵編成から順次追加していきます。今後、強編成等が確認された場合は編成が変わる可能性があります。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "基地空襲発生ボタンの挙動が正しくない場合がある問題を修正しました。"
			},
		],
	},
	{
		id: "1.11.0", changes: [
			{
				type: 0, title: "基地航空隊毎の個別派遣に対応しました。",
				content: "各基地航空隊それぞれ独立して好きな戦闘マスに飛ばせるようになりました。派遣先は「敵艦隊」欄にて敵編成を入力後、「基地派遣設定」ボタンから設定を行ってください。"
			},
			{
				type: 1, title: "防空計算と通常出撃計算を明確に切り替えるようにしました。",
				content: "新しく「防空計算モード」というボタンが追加され、これをONにすることで防空時の計算を行うようにしました。計算モードと札が一致している航空隊が計算の対象になります。"
			},
			{
				type: 0, title: "新装備を追加しました。",
				content: "四式重爆 飛龍、四式重爆 飛龍(熟練)を追加しました。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "複数タブで本サイトを閲覧している場合に編成を保存した際、保存先がおかしくなる不具合を修正しました。"
			},
		],
	},
	{
		id: "1.11.1", changes: [
			{
				type: 0, title: "夜間触接率の計算ができるようになりました。",
				content: "発動率の計算には搭載艦の練度がかかわるため、新しく練度の入力も可能になりました。夜偵を搭載した艦娘は艦娘の練度を正しく入力するようにしてください。"
			},
			{
				type: 1, title: "防空計算モード時の敵編成を保持するようになりました。",
				content: "防空計算モードで敵艦を指定し、その後通常計算モードで編成を保存しても、防空計算モードの敵艦を破棄せず保持するようになりました。"
			},
			{
				type: 1, title: "基地空襲発生ボタンの挙動を変更しました。",
				content: "設定次第では4機固定ではなくランダムで基地の機体を削る機能がありましたが、これによる誤操作と利用機会の少なさから、この機能をオミットしました。今後は空襲発生ボタンは常に最大の被害を起こすようになります。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "敵艦搭載数の詳細で意図しない敵艦情報が表示される現象、スクショ撮影機能利用時に一部機体が表示されなくなる現象、第2艦隊の触接率計算関連の不具合を修正しました。"
			},
		],
	},
	{
		id: "1.11.2", changes: [
			{
				type: 0, title: "基地の噴式強襲航空攻撃による撃墜を実装しました。",
				content: "噴式機の搭載数を削っておく等の操作は今後一切不要になります。なお、計算結果に表示されている基地の制空値は噴式強襲『後』の制空値が反映されており、基地航空隊編成欄の制空値は噴式強襲『前』の値が表示されています。"
			},
			{
				type: 1, title: "機体マウスホバー時に表示されるステータスを更新しました。",
				content: "雷装、爆装の改修効果を表示するようにしました。"
			},
			{
				type: 1, title: "機体一覧画面のソート機能の挙動を更新しました。",
				content: "機体一覧の雷装、爆装ソート時に改修効果を反映するようにしました。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "入力情報欄にて陸上偵察機の背景色が抜けていた問題を修正しました。"
			},
		],
	},
	{
		id: "1.11.3", changes: [
			{
				type: 0, title: "対空砲火設定欄の対空CI項目数を絞れる機能を追加しました。",
				content: "対空CI選択欄にある『対空CI種別表示設定』をクリックすると、プルダウン内に表示する対空CIの種別をカスタマイズできる設定画面になります。クリックすると表示、非表示が切り替えられます。"
			},
			{
				type: 0, title: "艦娘欄に射程表示を追加しました。",
				content: "2020秋E4やってて欲しかったので追加。装備に付与されている射程も考慮します。"
			},
			{
				type: 0, title: "機体マウスホバー時に表示されるステータスを更新しました。",
				content: "射程が変わる装備については、射程の項目が表示されるようになりました。"
			},
			{
				type: 0, title: "基地航空隊の噴式強襲攻撃時に減る鋼材を可視化しました。",
				content: "表示を行うには、各航空隊欄の『▼』ボタンをクリックしてください。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "深山、深山改の出撃時コストが間違っていたため修正しました。"
			}
		],
	},
	{
		id: "1.11.3.1", changes: [
			{
				type: 0, title: "データを更新しました。",
				content: "球磨改二を追加しました。新しく改修可能になった装備の対応を行いました。"
			},
			{
				type: 1, title: "2020秋イベント海域終了対応",
				content: "海域一覧の海域順を更新しました。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "防空計算モード時、敵機を撃墜した値が表示されてしまう現象を修正しました。"
			}
		],
	},
	{
		id: "1.11.3.2", changes: [
			{
				type: 0, title: "対地攻撃の可否を表示するようにしました。",
				content: "レイアウトを調整し、新しく対地不可の場合に表示がなされるようになりました。なお、特に記載がなければ対地攻撃できます。"
			},
			{
				type: 0, title: "機体マウスホバー時に表示されるステータスを更新しました。",
				content: "対地攻撃のできる艦爆について、対地攻撃可能である旨の表示を追加しました。"
			},
			{
				type: 1, title: "データを更新しました。",
				content: "爆装一式戦 隼III型改(65戦隊)の対空射撃回避性能を更新しました。（弱 → 中）"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "機体マウスホバー時に表示されるステータスについて、小数点以下を長々と表示されてしまう現象を修正しました。"
			}
		],
	},
	{
		id: "1.11.3.3", changes: [
			{
				type: 0, title: "機体一覧のソート / フィルタ条件に命中を追加しました。",
				content: ""
			},
			{
				type: 1, title: "新規敵艦の装備手動設定機能を更新しました。",
				content: "全ての装備を設定できるようになりました。また、艦隊防空値、加重対空値はシミュレータ側で計算するように更新したため、直接入力する必要はなくなりました。"
			},
			{
				type: 1, title: "データの更新を行いました。",
				content: "本シミュレータに実装されている敵艦の、艦載機以外の全ての装備情報を更新しました。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "特定の編成において、敵艦隊の対空砲火による撃墜数が増加する現象の修正を行いました。"
			}
		],
	},
	{
		id: "1.11.3.4", changes: [
			{
				type: 0, title: "機体一覧画面の表示ステータスを追加しました。",
				content: "「一列」表示時かつ、一定の大きさのブラウザの横幅がある場合、従来の表示に加え対空射撃回避の性能区分、機体配備コストを新たに表示するようにしました。"
			},
			{
				type: 1, title: "機体一覧画面の挙動が変更されました。",
				content: "判別しやすいよう、機体カテゴリの表示を拡大しました。また、水上戦闘機、大型飛行艇、噴式戦闘爆撃機、大型陸上機、陸上偵察機を新しくカテゴリ分けし、個別に表示できるようにしました。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "基地航空隊に出撃札と防空札を混在させた状態で、防空計算モードを選択するとエラーとなる現象を修正しました。また、おまかせ配備時に空母系に艦爆が搭載されない問題を修正しました。"
			}
		],
	},
	{
		id: "1.12.0", changes: [
			{
				type: 0, title: "実装全艦娘、装備を追加しました。",
				content: "これに伴い、他サイト様からデッキビルダー形式等で編成を取り込んだ場合でも、装備、艦娘情報を抜き落とさずに編成を復元できるようになりました。所持数の登録や、配備時前後の在庫数制御もこれまでの艦載機と同様に可能です。ご活用ください。"
			},
			{
				type: 0, title: "対空砲火性能を自動で算出するようになりました。",
				content: "艦隊入力欄で設定した装備や編成から、加重対空値、艦隊防空値、対空CIなどの撃墜性能を自動で算出するようになりました。今後、対空砲火情報の直接入力は不要になりますが、敵の棒立ち率を計算したい場合には、艦娘欄は全ての装備を配置するようにしてください。なお、艦娘の素対空値に関してはいかなる場合も近代化改修MAXの数値で計算します。"
			},
			{
				type: 0, title: "補強増設枠を追加しました。",
				content: "制空値には一切関与しませんので、制空状態のみ知りたい場合は入力不要です。対空砲火を正しく計算したい場合は実際の編成と同じように装備を搭載してください。配備した艦はもれなく補強増設枠が用意される石油王スタイルです。"
			},
			{
				type: 0, title: "敵艦マウスホバー時に装備情報を出すようにしました。",
				content: "「敵艦隊」欄の各種敵艦バナー上にマウスホバー時、該当の敵艦の簡易的な装備情報が表示されるようになりました。"
			},
			{
				type: 0, title: "6-4ボスマス基地派遣時の半径緩和仕様を実装しました。",
				content: "6-4ボスマスに噴式戦闘爆撃機を派遣すると半径が2になる仕様を実装し、これを満たす航空隊は半径不足の警告を出さないようにしました。"
			},
			{
				type: 1, title: "装備一覧画面を更新しました [1]",
				content: "全ての装備に対応しました。艦娘の装備選択時は、実際に搭載できる装備のみ表示されます。また、一覧画面左下のチェックボックスから今まで同様航空機のみの表示にもできますので、場合によって使い分けてください。"
			},
			{
				type: 1, title: "装備一覧画面を更新しました [2]",
				content: "ソート可能項目に加重対空値、艦隊防空ボーナスなどいくつか追加しました。また、「一列」表示時に表示される装備ステータスについて、特定の装備カテゴリを選択した際は、選択したカテゴリになんとなく応じたステータスを表示するようにしました。その他、細かいレイアウトの調整を行いました。"
			},
			{
				type: 1, title: "艦娘一覧画面を更新しました [1]",
				content: "全ての艦娘に対応しました。一覧画面左下のチェックボックスから今まで同様搭載数を持つ艦娘のみの表示にもできますので、場合によって使い分けてください。"
			},
			{
				type: 1, title: "艦娘一覧画面を更新しました [2]",
				content: "艦種選択の方法を変更し、タブ式に変更しました。また、通常の並び順を艦型順(赤城型 翔鶴型等)に変更しました。その他、一部レイアウトの調整を行い、一覧構築処理を見直し、高速化を行いました。"
			},
			{
				type: 1, title: "「対空砲火情報」欄を更新しました。",
				content: "対空砲火性能は自動で計算されるようになったため、専ら閲覧のみとなります。加重対空値一括入力機能、対空CI表示設定機能など入力補佐機能はこれに伴い全て廃止しました。"
			},
			{
				type: 1, title: "「入力情報」欄を廃止しました。",
				content: "各装備の制空値の内訳、防空時の制空値等が一通り各入力欄内で表示できるようになったことから、本表示を廃止しました。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "各種詳細計算時の挙動の不具合を修正しました。"
			}
		],
	},
	{
		id: "1.12.0.1", changes: [
			{
				type: 0, title: "装備のソート項目を瞬時に変更できるようになりました。",
				content: "装備の「一列」表示時、一覧のヘッダー部分をクリックすることで、クリックした項目で瞬時にソートされるような機能を追加しました。なお、基本的にソートは該当のステータスの降順です。『コスト』『名称』『図鑑id』のみ昇順となっています。"
			},
			{
				type: 0, title: "計算結果の精度を若干上げる機能を追加しました。",
				content: "通常の装備変更時に自動計算されるシミュレート回数では精度が心配な場合に、多少精度を上げての計算が手軽にできるようになります。マシンスペックによっては時間がかかるかもしれないのでお使いの端末の性能に自信がない場合は控えましょう。"
			},
			{
				type: 1, title: "二式艦上偵察機による射程バフ処理を追加しました。",
				content: "二航戦改二、伊勢型改二に搭載した際に、現状の射程を1段階伸ばす効果が未実装でしたが、こちら対応しました。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "6-4Mマスの半径の修正、海防艦が選択できない問題、15m二重測距儀+21号電探改二が戦艦以外にも搭載できた問題の修正を行いました。対空カットイン37種発動トリガの修正を行いました。"
			}
		],
	},
	{
		id: "1.12.1", changes: [
			{
				type: 0, title: "保存編成一覧にフォルダー機能を実装しました。",
				content: "各編成毎にフォルダーを選んで格納するボタンを配置しました。今まで保存されてきた編成はフォルダー未指定に設定されています。特定のフォルダーに任意の編成を一気に移動する機能もあります。フォルダーについては、編成一覧画面の最下部に20個用意しました。まずはこの数でお試しください。増設の要望が多ければ増設を検討します。"
			},
			{
				type: 0, title: "新艦娘、新装備を追加しました。",
				content: "能代改二、および15.2cm連装砲改二を追加しました。また、新しく改修可能になった装備に対応しました。"
			},
			{
				type: 0, title: "装備一覧画面の安定ソートに対応しました。",
				content: "ソート時に同じ値だった装備は、以前のソート状況を反映するようになりました。これまでと特に操作に変更はありません。"
			},
			{
				type: 1, title: "Sheffieldの対空カットイン発動条件を更新しました。",
				content: "2021/02/05のアップデートにより、Sheffieldが英国艦対空CIを発動可能になりましたので対応しました。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "一括入力機能による、戦闘機のみ熟練度最大ボタンを押下時、局地戦闘機が熟練度最大にならない問題を修正しました。"
			}
		],
	},
	{
		id: "1.12.1.1", changes: [
			{
				type: 0, title: "各艦娘毎の対空砲火情報を表示できるようにしました。",
				content: "艦隊入力欄の右上「対空砲火情報を表示する」にチェックを入れると、各艦娘の固定、割合撃墜数等の情報が入力画面内からそのまま確認できるようになります。いままでのように制空情報のみでよい場合は、チェックを外してください。"
			},
			{
				type: 0, title: "対空噴進弾幕発動率の計算が可能になりました。",
				content: "上述「対空砲火情報を表示する」にチェックが入っていると、対空噴進弾幕発動可能な艦については発動率が表示されるようになりました。発動率は艦娘の運の値が絡むため、運の入力欄も追加されています。"
			},
			{
				type: 0, title: "艦娘の運を変更できるようになりました。",
				content: "対空噴進弾幕発動率に関わる運の概念を本サイトにも追加しました。これに伴い、外部艦隊編成サイトとのやり取り時に運改修値も引き継げるようになりました。"
			},
			{
				type: 0, title: "編成一覧画面で空のフォルダー非表示機能を追加しました。",
				content: "編成が1件も格納されていないフォルダーを非表示にできるだけです。編成一覧画面の上部に追加されています。"
			},
			{
				type: 1, title: "スクリーンショット機能の挙動を微妙に変更しました。",
				content: "補強増設に装備を搭載していない場合、補強増設枠は非表示にするようにしました。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "一部装備の出撃対空値ソートが正しく動作しないケースがあった問題を修正しました。"
			}
		],
	},
	{
		id: "1.12.2", changes: [
			{
				type: 0, title: "航空戦マスを実装しました。",
				content: "通常の航空戦処理の後、双方の艦載機が減少した状態を反映した上での2回目の航空戦処理がなされるようにしました。今後、航空戦マスを選択した際に同じマスを2つ入力するなどといった手順は不要になります。"
			},
			{
				type: 1, title: "1-6, 5-2の一部マスの戦闘形式を変更しました。",
				content: "航空戦マスの処理を実装したことにより、1-6と5-2に存在する航空戦マスの形式を正しい戦闘形式に更新しました。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "触接詳細計算結果表示機能が一定条件で展開できなくなっていた問題を修正しました。"
			}
		],
	},
	{
		id: "1.12.2.1", changes: [
			{
				type: 0, title: "編成メモ入力欄を新設しました。",
				content: "画面右下に新設したメニューアイコンからアクセス可能です。「みんなの編成」から展開した場合もこのボタンからメモを確認できるようになりました。"
			},
			{
				type: 1, title: "計算画面の右下にメニューボタン群を追加しました。",
				content: "上述した編成メモ機能以外は、計算画面ヘッダー部分に表示されている各種メニューと同等の機能になっています。お好きな方をお使いください。"
			},
			{
				type: 2, title: "不具合の修正を行いました。",
				content: "潜水マスにて噴式強襲の鋼材消費が加算されるケースがある問題を修正しました。対地可能な艦爆搭載時の対地攻撃可否判定を修正しました。"
			}
		],
	},
	{
		id: "1.12.2.2", changes: [
			{
				type: 0, title: "データの更新を行いました。",
				content: "曙改二を追加しました。改修可能装備情報を更新しました。"
			}
		],
	},
	{
		id: "1.12.3", changes: [
			{
				type: 0, title: "航空戦火力計算機を実装しました。",
				content: "基地航空隊、または味方艦隊の搭載数詳細計算画面内にて、航空戦の火力計算が実行できるようになりました。選択された防御側の艦船に対して自動的に適切な火力計算を適用します。"
			}
		],
	}
];

const LAST_UPDATE_DATE = "2021/3/7";
