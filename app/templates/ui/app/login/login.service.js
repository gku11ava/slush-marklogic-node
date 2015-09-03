(function () {
  'use strict';

  angular.module('app.login')
    .factory('loginService', LoginService);

  LoginService.$inject = ['$http', '$modal', '$q', '$rootScope', '$state',
    '$stateParams', 'messageBoardService'];
  function LoginService($http, $modal, $q, $rootScope, $state, $stateParams, messageBoardService) {
    var _loginMode = 'full'; // 'modal', 'top-right', or 'full'
    var _loginError;
    var _isAuthenticated = false;
    var _toStateName;
    var _toStateParams;

    function loginMode(mode) {
      if (mode === undefined) {
        return _loginMode;
      }
      _loginMode = mode;
    }

    function failLogin(response) {
      if (response.status === 401) {
        _loginError = true;
      }
    }

    function loginError() {
      return _loginError;
    }

    function login(username, password) {
      return $http.post('/api/user/login', {
        'username': username,
        'password': password
      }).then(function(response) {
        _loginError = null;
        _isAuthenticated = true;
        $rootScope.$broadcast('loginService:login-success', response.data);
        return response;
      }, failLogin);
    }

    function loginPrompt() {
      var d = $q.defer();
      if (_loginMode === 'modal') {
        $modal.open({
          controller: ['$modalInstance', function($modalInstance) {
            var ctrl = this;
            ctrl.showCancel = $state.current.name !== 'root.landing';
            ctrl.close = function(user) {
              if (user) {
                d.resolve(user);
              } else {
                d.reject();
                $state.go('root.landing');
              }
              return $modalInstance.close();
            };
          }],
          controllerAs: 'ctrl',
          templateUrl: '/app/login/login-modal.html',
          backdrop: 'static',
          keyboard: false
        });
      } else if (_loginMode === 'top-right') {
        messageBoardService.message({title: 'Please sign-in to see content.'});
        var deregisterMsgBoard = $rootScope.$on('loginService:login-success', function(e, user) {
          messageBoardService.message(null);
          d.resolve(user);
          deregisterMsgBoard();
        });
      } else {
        $state.go('root.login',
          {
            'state': _toStateName || $state.current.name,
            'params': JSON.stringify((_toStateParams || $stateParams))
          }).then(function() {
            d.reject();
          });
      }
      return d.promise;
    }

    function logout() {
      return $http.get('/api/user/logout').then(function(response) {
        $rootScope.$broadcast('loginService:logout-success', response);
        _loginError = null;
        _isAuthenticated = false;
        $state.reload();
        return response;
      });
    }

    var _protectedRoutes = [];

    function isAuthenticated() {
      return _isAuthenticated;
    }

    function protectedRoutes(routes) {
      if (routes === undefined) {
        return _protectedRoutes;
      }
      _protectedRoutes = routes;
    }

    function routeIsProtected(route) {
      return _protectedRoutes.indexOf(route) > -1;
    }

    var deregisterLoginSuccess;

    $rootScope.$on('$stateChangeStart', function(event, next, nextParams) {
      if (next.name !== 'root.login') {
        _toStateName = next.name;
        _toStateParams = nextParams;
      }
      if (!isAuthenticated() && routeIsProtected(next.name)) {
        event.preventDefault();
        loginPrompt();
        if (_loginMode !== 'full') {
          if (deregisterLoginSuccess) {
            deregisterLoginSuccess();
            deregisterLoginSuccess = null;
          }
          deregisterLoginSuccess = $rootScope.$on('loginService:login-success', function() {
            deregisterLoginSuccess();
            deregisterLoginSuccess = null;
            $state.go(next.name, nextParams);
          });
        }
      }
    });

    return {
      login: login,
      logout: logout,
      loginPrompt: loginPrompt,
      loginError: loginError,
      loginMode: loginMode,
      isAuthenticated: isAuthenticated,
      protectedRoutes: protectedRoutes
    };
  }
}());