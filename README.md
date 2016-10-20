# GridSquares（仮称）
交互に点を置いて正方形をつくり、できた正方形の面積の和を競うオセロのようなゲーム

## Requirement
ソースからビルドする際に必要なもの

* Node.js (npm)
* grunt-cli `npm install -g grunt-cli`
* TypeScript `npm install -g typescript`

## Install
以下二つを実行すればpublic以下に一式が用意される

* `npm install`
* `grunt`

# ソースの構成について

## プレイヤーのクラス

AbstractGamePlayerを継承したクラスを実装することで、コンピュータ・ソロプレイヤーを実装している。

コントローラでどのPlayerを追加するかによりモードを切り替え可能

## 各クラスの関係

基本的にはMVCな構成、以下のようなイメージをもっておくとわかりやすいかもしれない

### Model

* GridPoint
* GridSquare

### Repository

クラス名をかっこ内に変えようか考えているところ

* GridPointList
* GridSquareList

### View

* GridBoardCanvasManager

### Controller

* GridSquareGameManager
* AbstractGamePlayer
* MainScreenController (Angular)
