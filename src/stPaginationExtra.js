ng.module('smart-table')
  .directive('stPaginationExtra', function () {
    return {
      restrict: 'EA',
      require: '^stTable',
      scope: {},
      templateUrl: function (element, attrs) {
        if (attrs.stTemplate) {
          return attrs.stTemplate;
        }
        return 'template/smart-table/paginationextra.html';
      },
      link: function (scope, element, attrs, ctrl) {

        scope.firstItem = 1;
	scope.lastItem = 1;
	scope.totalItems = 1;

        function redraw() {
          var paginationState = ctrl.tableState().pagination;
	  scope.firstItem = Math.min(paginationState.total, paginationState.start + 1);
	  scope.lastItem = Math.min(paginationState.total, paginationState.start + paginationState.number);
	  scope.totalItems = paginationState.total;
        }

        //table state --> view
        scope.$watch(function () {
          return ctrl.tableState().pagination;
        }, redraw, true);
	
      }
    };
  });
