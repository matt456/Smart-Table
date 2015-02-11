ng.module('smart-table')
    .directive('stSearch', ['$timeout', function ($timeout) {
        return {
            require: '^stTable',
            scope: {
                predicate: '=?stSearch'
            },
            link: function (scope, element, attr, ctrl) {
                var tableCtrl = ctrl;
                var promise = null;
                var throttle = attr.stDelay || 400;

                scope.$watch('predicate', function (newValue, oldValue) {
                    if (newValue !== oldValue) {
                        ctrl.tableState().search = {};
                        tableCtrl.search(element[0].value || '', newValue);
                    }
                });

                //table state -> view
                scope.$watch(function () {
                    return ctrl.tableState().search;
                }, function (newValue, oldValue) {
                    var predicateExpression = scope.predicate || '$';
                    if (newValue.predicateObject && newValue.predicateObject[predicateExpression] !== element[0].value) {
                        element[0].value = newValue.predicateObject[predicateExpression] || '';
                    }
                }, true);

		function searchFilter(evt) {
		    evt = evt.originalEvent || evt;
                    if (promise !== null) {
                        $timeout.cancel(promise);
                    }
                    promise = $timeout(function () {
                        tableCtrl.search(evt.target.value, scope.predicate || '');
                        promise = null;
                    }, throttle);
                }
		
                // view -> table state
		if (element.prop('tagName') == 'SELECT') {
			element.bind('change', searchFilter);
		} else {
			element.bind('input', searchFilter);
		}
            }
        };
    }]);
