
var apiModule = angular.module("GridSquareAPI", ["ngResource"]);
apiModule.factory("EndPoints", [function() {
    var baseUrl = "https://apps.jdb.jp/square_server/";
    return {
        "users": function() {
            return baseUrl + "users/";
        },
        "games": function() {
            return baseUrl + "games/";
        },
        "ws": function() {
            return baseUrl.replace("https", "wss").replace("http", "ws") + "ws/";
        },
        "baseUrl": function() {
            return baseUrl;
        },
        "setBaseUrl": function(url) {
            baseUrl = url;
        }
    };
}]);

apiModule.factory("AuthInfoService", [function() {
    var mapKey = "grid_square__session_key";
    var sessionKey = null;
    var savedSessionKey = window.localStorage.getItem(mapKey);
    if (savedSessionKey) sessionKey = savedSessionKey;
    return {
        "getSessionKey": function() {
            return sessionKey;
        },
        "setSessionKey": function(key) {
            sessionKey = key;
            window.localStorage.setItem(mapKey, key);
        },
        "hasSessionKey": function() {
            return !!sessionKey;
        }
    };
}]);

apiModule.factory("AuthInterceptor", ['AuthInfoService', 'EndPoints', function(AuthInfoService, EndPoints) {
    return {
        "request": function(config) {
            if (config.url.indexOf(EndPoints.baseUrl()) == -1) return config;
            if (!config.params) config.params = {};
            config.params["session_key"] = AuthInfoService.getSessionKey();
            return config;
        }
    };
}]).config(['$httpProvider', function($httpProvider) {
    $httpProvider.interceptors.push("AuthInterceptor");
}]);

apiModule.factory("UserApi", ["$http", "EndPoints", "$q", "AuthInfoService", function($http, EndPoints, $q, authInfoService) {
    var that = {
        "checkSessionKeyOrCreateUser": function(userName) {
            if (authInfoService.hasSessionKey()) {
                var request = $q.defer();
                that.checkSessionKey().then(function(d) {
                    request.resolve(d);
                }, function() {
                    that.createNewUser(userName).then(function(d) {
                        request.resolve(d);
                    }, function(d) {
                        request.reject(d);
                    });
                });
                return request.promise;
            } else {
                return that.createNewUser(userName);
            }
        },
        "createNewUser": function(userName) {
            var request = $q.defer();
            $http({
                'method': 'POST',
                'url': EndPoints.users(),
                'params': {
                    'user_name': userName || "New User"
                }
            }).then(function(d) {
                authInfoService.setSessionKey(d.data.user.session_key);
                request.resolve(d);
            }, function(d) {
                request.reject(d);
            });
            return request.promise;
        },
        "checkSessionKey": function() {
            //session_keyはinterceptorで設定
            var request = $q.defer();
            $http({
                'method': 'GET',
                'url': EndPoints.users() + "me/"
            }).then(function(d) {
                request.resolve(d);
            }, function(d) {
                authInfoService.setSessionKey(null);
                request.reject(d);
            });
            return request.promise;
        }
    }
    return that;
}]);

apiModule.factory("GameApi", ["$http", "EndPoints", "$q", function($http, EndPoints, $q) {
    return {
        "createNewGame": function(gameName, gamePass) {
            return $http({
                'method': 'POST',
                'url': EndPoints.games(),
                'params': {
                    'game_name': gameName,
                    'game_pass': gamePass
                }
            });
        },
        "getGame": function(gameId, gamePass) {
            return $http({
                'method': 'GET',
                'url': EndPoints.games() + Number(gameId) + "/",
                'params': {
                    'game_pass': gamePass
                }
            });
        },
        "attendGame": function(gameId, mySide) {
            return $http({
                'method': 'PUT',
                'url': EndPoints.games() + Number(gameId) + "/",
                'params': {
                    'my_side': mySide
                }
            });
        },
        "getMoves": function(gameId) {
            return $http({
                'method': 'GET',
                'url': EndPoints.games() + Number(gameId) + "/moves/"
            });
        },
        "postMove": function(gameId, x, y) {
            return $http({
                'method': 'GET',
                'url': EndPoints.games() + Number(gameId) + "/moves/",
                'params': {
                    'x': Number(x),
                    'y': Number(y)
                }
            });
        }
    }
}]);
