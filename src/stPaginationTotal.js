ng.module('smart-table')
  .directive('stPaginationTotal', function () {
    return {
      restrict: 'EA',
      require: '^stTable',
      scope: {
        stUptoLimit: '=?',
      },
      templateUrl: function (element, attrs) {
        if (attrs.stTemplate) {
          return attrs.stTemplate;
        }
        return 'template/smart-table/paginationtotal.html';
      },
      link: function (scope, element, attrs, ctrl) {

        scope.stUptoLimit = scope.stUptoLimit ? +(scope.stUptoLimit) : 10;
	      
	scope.limitItems = 1;
	scope.totalItems = 1;

        function redraw() {
          var paginationState = ctrl.tableState().pagination;
	  scope.limitItems = Math.min(paginationState.total, scope.stUptoLimit);
	  scope.totalItems = paginationState.total;
        }

        //table state --> view
        scope.$watch(function () {
          return ctrl.tableState().pagination;
        }, redraw, true);

        //scope --> table state  (--> view)
        scope.$watch('stUptoLimit', function (newValue, oldValue) {
          if (newValue !== oldValue) {
            redraw();
          }
        });
	
      }
    };
  });
