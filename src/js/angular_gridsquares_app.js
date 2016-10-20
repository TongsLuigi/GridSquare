
var mainModule = angular.module("GridSquareGame", ["ngRoute", "ngCookies", "GridSquareAPI"]);
mainModule.config(['$routeProvider', function($routeProvider) {
    $routeProvider
    .when('/', {
        templateUrl: 'templates/title.html'
    })
    .when('/game/:mode', {
        templateUrl: 'templates/game.html'
    })
    .when('/game/:mode/:game_id', {
        templateUrl: 'templates/game.html'
    })
    .when('/remote/choose_server', {
        templateUrl: 'templates/choose_server.html'
    })
    .when('/remote/choose_game', {
        templateUrl: 'templates/choose_game.html'
    })
    .when('/remote/choose_side', {
        templateUrl: 'templates/choose_side.html'
    })
    .otherwise({
        redirectTo: '/'
    });
}]);
mainModule.provider("GridSauareGameManager", function() {
    this.canvas = null;
    this.$get = function() {
        var canvas = this.canvas;
        return new GridSquareGameManager(canvas);
    }
});
mainModule.config(["GridSauareGameManagerProvider", function(managerProvider) {
    managerProvider.canvas = null;
}]);

mainModule.controller("GameScreenController", ["UserApi", "GameApi", "$timeout", "GridSauareGameManager", "$routeParams", "$scope", "EndPoints", "AuthInfoService", "$location", function(UserApi, GameApi, $timeout, gameManager, $routeParams, $scope, EndPoints, AuthInfoService, $location) {
    var self = this;
    self.playerPoints = {
        player1: 0,
        player2: 0
    };
    self.rectanglesCount = {
        player1: 0,
        player2: 0
    };
    self.strokeEnabledStates = [false, true, true];
    self.switchStrokeEnabled = function(side) {
        self.strokeEnabledStates[side] = !gameManager.switchStrokeEnabled(side);
    }
    self.getStrokeEnabledIconClass = function(side) {
        var classMap = {
            "fa": true
        };
        if (self.strokeEnabledStates[side]) {
            classMap["fa-eye"] = true;
        } else {
            classMap["fa-eye-slash"] = true;
        }
        return classMap;
    }

    gameManager.setCanvas(document.getElementById("canvas_main_board"));

    var calcPoints = function() {
        var list = gameManager.getSquareList();
        $timeout(function() {
            var list1 = list.getSubsetSideEquals(1);
            var list2 = list.getSubsetSideEquals(2);

            self.playerPoints.player1 = list1.getPointsSum();
            self.playerPoints.player2 = list2.getPointsSum();
            self.rectanglesCount.player1 = list1.size();
            self.rectanglesCount.player2 = list2.size();
        });
    }

    var checkIfMatchFinished = function() {
        var list = gameManager.getSquareList();
        $timeout(function() {
            var list1 = list.getSubsetSideEquals(1);
            var list2 = list.getSubsetSideEquals(2);
            var pointsP1 = list1.getPointsSum();
            var pointsP2 = list2.getPointsSum();
            if (pointsP1 > pointsP2) {
                self.resultMsg = "Player1の勝利！";
                self.playerClass = {"color_player_1": true};
            } else if (pointsP1 < pointsP2) {
                self.resultMsg = "Player2の勝利！";
                self.playerClass = {"color_player_2": true};
            } else if (pointsP1 == pointsP2) {
                self.resultMsg = "引き分け！";
                self.playerClass = {"color_player_draw": true};
            }
        });
    }

    gameManager.setOnGridPointClickListener(function() {
        calcPoints();
    });

    self.playerClass = {};
    gameManager.setOnGameCompleteListener(function() {
        checkIfMatchFinished();
    });

    var tempMsgPromise = null;
    gameManager.setOnPlayerSwitchListener(function(newPlayer, isInterruption) {
        $timeout(function() {
            //do nothing
        });
    });

    var wsWrapperGlobal = null;

    self.playersConnectedStatus = {
        1: false,
        2: false
    };

    self.getPlayerStatusMessage = function(player) {
        return self.playersConnectedStatus[player] ? "CONNECTED" : "WAITING...";
    }

    self.getPlayerStatusIconClass = function(player) {
        return {};
    }

    self.askShouldShowConnectionStatus = function() {
        return self.gameMode.indexOf("REMOTE") != -1;
    }

    if ($routeParams.mode == "remote") {
        var gameId = $routeParams.game_id;
        self.gameMode = "REMOTE (ROOM: " + gameId + ")";

        GameApi.getMoves(gameId).then(function(d) {
            //この辺もそのうち分離する
            var game = d.data.game;
            var user = d.data.user;
            var moves = d.data.moves;

            var remoteGameManager = new RemoteGameManager(gameManager);
            var remoteServerHelper = new RemoteServerHelper();

            remoteGameManager.getRemoteGameId(gameId);

            remoteServerHelper.setRequestListener(function(d) {
                if (d.getRequestDomain() == RemoteServerHelper.REQUEST_DOMAIN_GAME) {
                    console.log(d);
                    if (d.getRequestType() == RemoteServerHelper.REQUEST_TYPE_REQUEST_MOVE_PERMISSION) {
                        //自分の番で動かす権限について
                        //とりあえずただちに権限を与える
                        var dataWrapper = new RemoteServerDataWrapper(RemoteServerHelper.REQUEST_DOMAIN_GAME, RemoteServerHelper.REQUEST_TYPE_ALLOW_NEXT_MOVE);
                        remoteServerHelper.injectResponse(dataWrapper);
                    } else if (d.getRequestType() == RemoteServerHelper.REQUEST_TYPE_REQUEST_NEXT_MOVE) {
                        //相手が動かすのを待つ＝broadcastの待機
                    } else if (d.getRequestType() == RemoteServerHelper.REQUEST_TYPE_INPUTED_NEXT_MOVE) {
                        var body = d.getDataBody();
                        //WebSocketで自分の手を送信する
                        wsWrapper.send({
                            'METHOD': 'POST',
                            'PATH': '/games/:game_id/moves',
                            'QUERIES': {
                                'session_key': AuthInfoService.getSessionKey(),
                                'game_id': gameId,
                                'x': body.x,
                                'y': body.y
                            }
                        }, "1");
                    }
                } else {
                    //ここは今のところ存在しない
                }
            });

            remoteGameManager.setRemoteServerHelper(remoteServerHelper);

            //観戦を実装する場合はここを変更
            if (game.player1_id == user.id) {
                //自分が先攻
                remoteGameManager.setPlayersSide(1, 2);
            } else {
                //自分が後攻
                remoteGameManager.setPlayersSide(2, 1);
            }

            var uri = EndPoints.ws();
            uri = uri;

            var wsWrapper = new WebSocketWrapper(uri);
            wsWrapperGlobal = wsWrapper;

            var authFunc = function(){
                //認証
                wsWrapper.send({
                    'METHOD': 'GET',
                    'PATH': '/games/:game_id',
                    'QUERIES': {
                        'session_key': AuthInfoService.getSessionKey(),
                        'game_id': gameId
                    }
                }, "0");
            }

            wsWrapper.connect(authFunc);

            self.shouldReconnect = false;
            self.doReconnect = function() {
                wsWrapper.connect(authFunc);
            }

            wsWrapper.setOnClientsInfoListener(function(d) {
                console.log(d);
                var newUsers = d.users;
                var newGame = d.game;
                game = newGame;
                var foundP1 = false;
                var foundP2 = false;
                newUsers.forEach(function(item) {
                    if (item.id == game.player1_id) {
                        foundP1 = true;
                    } else if (item.id == game.player2_id){
                        foundP2 = true;
                    }
                });
                if (gameManager.askHasStarted()) {
                    if (foundP1 && foundP2) {
                        gameManager.resume();
                    } else {
                        console.log("pausing");
                        gameManager.pause();
                    }
                } else {
                    if (foundP1 && foundP2) {
                        //そのまま開始してOK
                    } else {
                        console.log("will be pausing");
                        gameManager.toPause();
                    }
                }
                $timeout(function() {
                    self.playersConnectedStatus[1] = foundP1;
                    self.playersConnectedStatus[2] = foundP2;
                });
            });

            wsWrapper.setOnResponseListener(function(data, id) {
                console.log(data);
                self.shouldReconnect = false;
                if (id == "0") {
                    remoteGameManager.initGamePlayers();
                    gameManager.start();

                    //ここで既存の手を一通り反映する
                    moves.forEach(function(move) {
                        gameManager.injectClickedPoint(move[1], move[2], move[3]);
                    });
                    if (moves.length > 0) {
                        var lastSide = moves[moves.length-1][1];
                        gameManager.setCurrentSide(lastSide == 2 ? 1 : 2);
                    }
                } else if (id == "1") {
                    console.log(data);
                    var dataWrapper = new RemoteServerDataWrapper(RemoteServerHelper.REQUEST_DOMAIN_GAME, RemoteServerHelper.REQUEST_TYPE_UPDATE_REMOTE_MOVE);
                    dataWrapper.setDataBody({'move': data.move});
                    remoteServerHelper.injectResponse(dataWrapper);
                    if (Number(data.other_players_move)) {
                        //自分の手
                    } else {
                        //相手の手
                    }
                }
            });

            wsWrapper.setOnCloseListener(function() {
                $timeout(function() {
                    self.shouldReconnect = true;
                    self.playersConnectedStatus[1] = false;
                    self.playersConnectedStatus[2] = false;
                    gameManager.pause();
                });
            });

        }, function() {
            alert("ユーザ情報なし、またはゲームなし");
            return $location.path("/");
        });


    } else {
        if ($routeParams.mode == "vs_cp_first") {
            gameManager.setGameMode(GridSquareGameManager.MODE_VS_COMPUTER_COMPUTER_FIRST);
            self.gameMode = "VS. COMPUTER (CP FIRST)";
        } else if ($routeParams.mode == "solo") {
            gameManager.setGameMode(GridSquareGameManager.MODE_SOLO);
            self.gameMode = "SOLO";
        } else if ($routeParams.mode == "exhibition") {
            gameManager.setGameMode(GridSquareGameManager.MODE_EXHIBITION);
            self.gameMode = "EXHIBITION";
        } else if ($routeParams.mode == "vs_player_first" || true) {
            //else
            gameManager.setGameMode(GridSquareGameManager.MODE_VS_COMPUTER_PLAYER_FIRST);
            self.gameMode = "VS. COMPUTER (PLAYER FIRST)";
        }
        gameManager.start();
    }

    $scope.$on('$routeChangeStart', function(ev, current){
        gameManager.dispose();
        wsWrapperGlobal && wsWrapperGlobal.close();
    });
}]);

mainModule.controller("TitleScreenController", ["$scope", "$location", "$routeParams", function($scope, $location, $routeParams) {
    var self = this;

    self.goToGameScreen = function(type) {
        $location.path("/game/" + type);
    }

    self.goToRemoteScreen = function() {
        $location.path("/remote/choose_server");
    }
}]);

mainModule.controller("ChooseServerScreenController", ["$scope", "$location", "$routeParams", "EndPoints", "UserApi", function($scope, $location, $routeParams, EndPoints, UserApi) {
    var self = this;

    var goToNextScreen = function() {
        $location.path("/remote/choose_game");
    }

    $scope.$on('$routeChangeStart', function(ev, current){
        current.params.last_page = "CHOOSE_SERVER";
    });

    self.serverUrl = EndPoints.baseUrl();
    self.goToChooseGameScreen = function() {
        EndPoints.setBaseUrl(self.serverUrl);
        UserApi.checkSessionKeyOrCreateUser().then(function() {
            goToNextScreen();
        }, function() {
            alert("サーバに接続できません。接続先を確認してください。");
        });
    }
}]);

mainModule.controller("ChooseGameScreenController", ["$scope", "$location", "$routeParams", "GameApi", function($scope, $location, $routeParams, GameApi) {
    var self = this;
    if ($routeParams.last_page != "CHOOSE_SERVER") return $location.path("/");

    var gameIdToPass = null;
    var goToNextScreen = function() {
        $location.path("remote/choose_side");
    }

    $scope.$on('$routeChangeStart', function(ev, current){
        if (gameIdToPass) {
            current.params.gameId = gameIdToPass;
            current.params.last_page = "CHOOSE_GAME";
        }
    });

    self.gameName = "";
    self.gamePass = "00000";
    self.createNewGame = function() {
        if (self.gameName == "") return;
        GameApi.createNewGame(self.gameName, self.gamePass).then(function(d) {
            var game = d.data.game;
            gameIdToPass = game.id;
            console.log(d);
            goToNextScreen();
        }, function() {
            alert("エラー（ToDo: 原因表示）");
        });
    }

    self.gameId = "";
    self.gamePassToLogin = "00000";
    self.attendGame = function() {
        if (self.gameId == "") return;
        GameApi.getGame(self.gameId, self.gamePassToLogin).then(function(d) {
            var game = d.data.game;
            if (game.player1_id && game.player2_id) {
                alert("ゲーム画面に直接移動します。");
                $location.path("game/remote/" + game.id);
            } else {
                gameIdToPass = game.id;
                console.log(d);
                goToNextScreen();
            }
        }, function() {
            alert("エラー（部屋が存在しない、または暗証番号が違う）");
        });
    }

}]);

mainModule.controller("ChooseSideScreenController", ["$scope", "$location", "$routeParams", "GameApi", function($scope, $location, $routeParams, GameApi) {
    var self = this;
    var gameId = $routeParams.gameId;//DEBUG
    if ($routeParams.last_page != "CHOOSE_GAME") return $location.path("/");

    var goToNextScreen = function() {
        $location.path("game/remote/" + gameId);
    }

    self.game = {};
    GameApi.getGame(gameId).then(function(d) {
        self.game = d.data.game;
        console.log(d);
    }, function(e) {
        alert("該当ゲームが存在しません。タイトルへ戻ります。");
        $location.path("/");
    });

    self.chooseSide = function(side) {
        if (!confirm((side == 1 ? "先攻" : "後攻") + "で確定します")) return;
        GameApi.attendGame(gameId, side).then(function(d) {
            alert("選択完了、ゲーム画面に移動します。");
            goToNextScreen();
        }, function(d) {
            alert("おそらくもう一人が同じサイドを選んでいる（ToDo: エラー振り分け）");
        });
    }
}]);
