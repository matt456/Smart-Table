/** 
* @version 1.4.12
* @license MIT
*/
(function (ng, undefined){
    'use strict';

ng.module('smart-table', []).run(['$templateCache', function ($templateCache) {
    $templateCache.put('template/smart-table/pagination.html',
        '<nav ng-if="pages.length >= 2"><ul class="pagination pagination-sm no-top-margin no-bottom-margin">' +
        '<li ng-repeat="page in pages" ng-class="{active: page==currentPage}"><a ng-click="selectPage(page)">{{page}}</a></li>' +
        '</ul></nav>');
    $templateCache.put('template/smart-table/paginationextra.html',
        '{{firstItem}} to {{lastItem}} of {{totalItems}}');	
    $templateCache.put('template/smart-table/paginationtotal.html',
        '{{limitItems}} of {{totalItems}}');	
}]);


ng.module('smart-table')
  .controller('stTableController', ['$scope', '$parse', '$filter', '$attrs', function StTableController($scope, $parse, $filter, $attrs) {
    var propertyName = $attrs.stTable;
    var displayGetter = $parse(propertyName);
    var displaySetter = displayGetter.assign;
    var safeGetter;
    var orderBy = $filter('orderBy');
    var filter = $filter('filter');
    var safeCopy = copyRefs(displayGetter($scope));
    var tableState = {
      sort: {},
      search: {},
      pagination: {
        start: 0
      }
    };
    var pipeAfterSafeCopy = true;
    var ctrl = this;
    var lastSelected;

    function copyRefs(src) {
      return src ? [].concat(src) : [];
    }

    function updateSafeCopy() {
      safeCopy = copyRefs(safeGetter($scope));
      if (pipeAfterSafeCopy === true) {
        ctrl.pipe();
      }
    }

    if ($attrs.stSafeSrc) {
      safeGetter = $parse($attrs.stSafeSrc);
      $scope.$watch(function () {
        var safeSrc = safeGetter($scope);
        return safeSrc ? safeSrc.length : 0;

      }, function (newValue, oldValue) {
        if (newValue !== safeCopy.length) {
          updateSafeCopy();
        }
      });
      $scope.$watch(function () {
        return safeGetter($scope);
      }, function (newValue, oldValue) {
        if (newValue !== oldValue) {
          updateSafeCopy();
        }
      });
    }

	//MC this is horrible but a way of getting access to the value to see if it's been initialized in the directive
	this.modelVal = function modelVal(whichmodel, endval) {
		if (angular.isDefined(whichmodel) && (whichmodel !== null))
		{
			var findDot = whichmodel.indexOf('.');
			if (findDot !== -1)
			{
				var ctrlr = whichmodel.substr(0,findDot);
				var varbl = whichmodel.substr(findDot+1);
				if (angular.isDefined($scope[ctrlr][varbl]))
				{
					if (endval === null)
					{
						return $scope[ctrlr][varbl];
					}
					if ($scope[ctrlr][varbl] === null)
					{
						return null;
					}
					if (angular.isDefined($scope[ctrlr][varbl][endval]))
					{
						return $scope[ctrlr][varbl][endval];
					}
				}
			}
		}
		return null;
	};    
    
    /**
     * sort the rows
     * @param {Function | String} predicate - function or string which will be used as predicate for the sorting
     * @param [reverse] - if you want to reverse the order
     */
    this.sortBy = function sortBy(predicate, reverse) {
      tableState.sort.predicate = predicate;
      tableState.sort.reverse = reverse === true;

      if (ng.isFunction(predicate)) {
        tableState.sort.functionName = predicate.name;
      } else {
        delete tableState.sort.functionName;
      }

      tableState.pagination.start = 0;
      return this.pipe();
    };

    /**
     * search matching rows
     * @param {String} input - the input string
     * @param {String} [predicate] - the property name against you want to check the match, otherwise it will search on all properties
     */
    this.search = function search(input, predicate) {
      var predicateObject = tableState.search.predicateObject || {};
      var prop = predicate ? predicate : '$';

      input = ng.isString(input) ? input.trim() : input;
      predicateObject[prop] = input;
      // to avoid to filter out null value
      if (!input) {
        delete predicateObject[prop];
      }
      tableState.search.predicateObject = predicateObject;
      tableState.pagination.start = 0;
      return this.pipe();
    };

    /**
     * this will chain the operations of sorting and filtering based on the current table state (sort options, filtering, ect)
     */
    this.pipe = function pipe() {
      var pagination = tableState.pagination;
      var filtered = tableState.search.predicateObject ? filter(safeCopy, tableState.search.predicateObject) : safeCopy;
      if (tableState.sort.predicate) {
        filtered = orderBy(filtered, tableState.sort.predicate, tableState.sort.reverse);
      }
      
      //MC record total of filtered items
      pagination.total = filtered.length;
      
      if (pagination.number !== undefined) {
        pagination.numberOfPages = filtered.length > 0 ? Math.ceil(filtered.length / pagination.number) : 1;
        pagination.start = pagination.start >= filtered.length ? (pagination.numberOfPages - 1) * pagination.number : pagination.start;
        filtered = filtered.slice(pagination.start, pagination.start + parseInt(pagination.number));
      }
      displaySetter($scope, filtered);
    };

    /**
     * select a dataRow (it will add the attribute isSelected to the row object)
     * @param {Object} row - the row to select
     * @param {String} [mode] - "single" or "multiple" (multiple by default)
     */
    this.select = function select(row, mode) {
      var rows = safeCopy;
      var index = rows.indexOf(row);
      if (index !== -1) {
        if (mode === 'single') {
          row.isSelected = row.isSelected !== true;
          if (lastSelected) {
            lastSelected.isSelected = false;
          }
          lastSelected = row.isSelected === true ? row : undefined;
        } else {
          rows[index].isSelected = !rows[index].isSelected;
        }
      }
    };

    /**
     * take a slice of the current sorted/filtered collection (pagination)
     *
     * @param {Number} start - start index of the slice
     * @param {Number} number - the number of item in the slice
     */
    this.slice = function splice(start, number) {
      tableState.pagination.start = start;
      tableState.pagination.number = number;
      return this.pipe();
    };

    /**
     * return the current state of the table
     * @returns {{sort: {}, search: {}, pagination: {start: number}}}
     */
    this.tableState = function getTableState() {
      return tableState;
    };

    /**
     * Use a different filter function than the angular FilterFilter
     * @param filterName the name under which the custom filter is registered
     */
    this.setFilterFunction = function setFilterFunction(filterName) {
      filter = $filter(filterName);
    };

    /**
     *User a different function than the angular orderBy
     * @param sortFunctionName the name under which the custom order function is registered
     */
    this.setSortFunction = function setSortFunction(sortFunctionName) {
      orderBy = $filter(sortFunctionName);
    };

    /**
     * Usually when the safe copy is updated the pipe function is called.
     * Calling this method will prevent it, which is something required when using a custom pipe function
     */
    this.preventPipeOnWatch = function preventPipe() {
      pipeAfterSafeCopy = false;
    };
  }])
  .directive('stTable', function () {
    return {
      restrict: 'A',
      controller: 'stTableController',
      link: function (scope, element, attr, ctrl) {

        if (attr.stSetFilter) {
          ctrl.setFilterFunction(attr.stSetFilter);
        }

        if (attr.stSetSort) {
          ctrl.setSortFunction(attr.stSetSort);
        }
      }
    };
  });

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

		//MC initialize the search if values set for our model
		var endval = null;
		if (angular.isDefined(attr.ngOptions))
		{
			var findDot = attr.ngOptions.lastIndexOf('.');
			if (findDot !== -1)
			{
				endval = attr.ngOptions.substr(findDot + 1);
			}
		}
		    
		var initVal = ctrl.modelVal(attr.ngModel, endval);
		if (initVal !== null)
		{
			tableCtrl.search(initVal, scope.predicate || '');
		}
		    
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

ng.module('smart-table')
  .directive('stSelectRow', function () {
    return {
      restrict: 'A',
      require: '^stTable',
      scope: {
        row: '=stSelectRow'
      },
      link: function (scope, element, attr, ctrl) {
        var mode = attr.stSelectMode || 'single';
        element.bind('click', function () {
          scope.$apply(function () {
            ctrl.select(scope.row, mode);
          });
        });

        scope.$watch('row.isSelected', function (newValue) {
          if (newValue === true) {
            element.addClass('st-selected');
          } else {
            element.removeClass('st-selected');
          }
        });
      }
    };
  });

ng.module('smart-table')
  .directive('stSort', ['$parse', function ($parse) {
    return {
      restrict: 'A',
      require: '^stTable',
      link: function (scope, element, attr, ctrl) {

        var predicate = attr.stSort;
        var getter = $parse(predicate);
        var index = 0;
        var classAscent = attr.stClassAscent || 'st-sort-ascent';
        var classDescent = attr.stClassDescent || 'st-sort-descent';
        var stateClasses = [classAscent, classDescent];
        var sortDefault;

        if (attr.stSortDefault) {
          sortDefault = scope.$eval(attr.stSortDefault) !== undefined ?  scope.$eval(attr.stSortDefault) : attr.stSortDefault;
        }

        //view --> table state
        function sort() {
          index++;
          predicate = ng.isFunction(getter(scope)) ? getter(scope) : attr.stSort;
          if (index % 3 === 0 && attr.stSkipNatural === undefined) {
            //manual reset
            index = 0;
            ctrl.tableState().sort = {};
            ctrl.tableState().pagination.start = 0;
            ctrl.pipe();
          } else {
            ctrl.sortBy(predicate, index % 2 === 0);
          }
        }

        element.bind('click', function sortClick() {
          if (predicate) {
            scope.$apply(sort);
          }
        });

        if (sortDefault) {
          index = attr.stSortDefault === 'reverse' ? 1 : 0;
          sort();
        }

        //table state --> view
        scope.$watch(function () {
          return ctrl.tableState().sort;
        }, function (newValue) {
          if (newValue.predicate !== predicate) {
            index = 0;
            element
              .removeClass(classAscent)
              .removeClass(classDescent);
          } else {
            index = newValue.reverse === true ? 2 : 1;
            element
              .removeClass(stateClasses[index % 2])
              .addClass(stateClasses[index - 1]);
          }
        }, true);
      }
    };
  }]);

ng.module('smart-table')
  .directive('stPagination', function () {
    return {
      restrict: 'EA',
      require: '^stTable',
      scope: {
        stItemsByPage: '=?',
        stDisplayedPages: '=?',
        stPageChange: '&'
      },
      templateUrl: function (element, attrs) {
        if (attrs.stTemplate) {
          return attrs.stTemplate;
        }
        return 'template/smart-table/pagination.html';
      },
      link: function (scope, element, attrs, ctrl) {

        scope.stItemsByPage = scope.stItemsByPage ? +(scope.stItemsByPage) : 10;
        scope.stDisplayedPages = scope.stDisplayedPages ? +(scope.stDisplayedPages) : 5;

        scope.currentPage = 1;
        scope.pages = [];

        function redraw() {
          var paginationState = ctrl.tableState().pagination;
          var start = 1;
          var end;
          var i;
          var prevPage = scope.currentPage;
          scope.currentPage = Math.floor(paginationState.start / paginationState.number) + 1;

          start = Math.max(start, scope.currentPage - Math.abs(Math.floor(scope.stDisplayedPages / 2)));
          end = start + scope.stDisplayedPages;

          if (end > paginationState.numberOfPages) {
            end = paginationState.numberOfPages + 1;
            start = Math.max(1, end - scope.stDisplayedPages);
          }

          scope.pages = [];
          scope.numPages = paginationState.numberOfPages;

          for (i = start; i < end; i++) {
            scope.pages.push(i);
          }

          if (prevPage!==scope.currentPage) {
            scope.stPageChange({newPage: scope.currentPage});
          }
        }

        //table state --> view
        scope.$watch(function () {
          return ctrl.tableState().pagination;
        }, redraw, true);

        //scope --> table state  (--> view)
        scope.$watch('stItemsByPage', function (newValue, oldValue) {
          if (newValue !== oldValue) {
            scope.selectPage(1);
          }
        });

        scope.$watch('stDisplayedPages', redraw);

        //view -> table state
        scope.selectPage = function (page) {
          if (page > 0 && page <= scope.numPages) {
            ctrl.slice((page - 1) * scope.stItemsByPage, scope.stItemsByPage);
          }
        };

        if(!ctrl.tableState().pagination.number){
          ctrl.slice(0, scope.stItemsByPage);
        }
      }
    };
  });

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

ng.module('smart-table')
  .directive('stPipe', function () {
    return {
      require: 'stTable',
      scope: {
        stPipe: '='
      },
      link: {

        pre: function (scope, element, attrs, ctrl) {
          if (ng.isFunction(scope.stPipe)) {
            ctrl.preventPipeOnWatch();
            ctrl.pipe = function () {
              return scope.stPipe(ctrl.tableState(), ctrl);
            }
          }
        },

        post: function (scope, element, attrs, ctrl) {
          ctrl.pipe();
        }
      }
    };
  });

})(angular);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy90b3AudHh0Iiwic3JjL3NtYXJ0LXRhYmxlLm1vZHVsZS5qcyIsInNyYy9zdFRhYmxlLmpzIiwic3JjL3N0U2VhcmNoLmpzIiwic3JjL3N0U2VsZWN0Um93LmpzIiwic3JjL3N0U29ydC5qcyIsInNyYy9zdFBhZ2luYXRpb24uanMiLCJzcmMvc3RQYWdpbmF0aW9uRXh0cmEuanMiLCJzcmMvc3RQYWdpbmF0aW9uVG90YWwuanMiLCJzcmMvc3RQaXBlLmpzIiwic3JjL2JvdHRvbS50eHQiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDN05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDaEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMvRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNqQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN4QkEiLCJmaWxlIjoic21hcnQtdGFibGUuanMiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gKG5nLCB1bmRlZmluZWQpe1xyXG4gICAgJ3VzZSBzdHJpY3QnO1xyXG4iLCJuZy5tb2R1bGUoJ3NtYXJ0LXRhYmxlJywgW10pLnJ1bihbJyR0ZW1wbGF0ZUNhY2hlJywgZnVuY3Rpb24gKCR0ZW1wbGF0ZUNhY2hlKSB7XHJcbiAgICAkdGVtcGxhdGVDYWNoZS5wdXQoJ3RlbXBsYXRlL3NtYXJ0LXRhYmxlL3BhZ2luYXRpb24uaHRtbCcsXHJcbiAgICAgICAgJzxuYXYgbmctaWY9XCJwYWdlcy5sZW5ndGggPj0gMlwiPjx1bCBjbGFzcz1cInBhZ2luYXRpb24gcGFnaW5hdGlvbi1zbSBuby10b3AtbWFyZ2luIG5vLWJvdHRvbS1tYXJnaW5cIj4nICtcclxuICAgICAgICAnPGxpIG5nLXJlcGVhdD1cInBhZ2UgaW4gcGFnZXNcIiBuZy1jbGFzcz1cInthY3RpdmU6IHBhZ2U9PWN1cnJlbnRQYWdlfVwiPjxhIG5nLWNsaWNrPVwic2VsZWN0UGFnZShwYWdlKVwiPnt7cGFnZX19PC9hPjwvbGk+JyArXHJcbiAgICAgICAgJzwvdWw+PC9uYXY+Jyk7XHJcbiAgICAkdGVtcGxhdGVDYWNoZS5wdXQoJ3RlbXBsYXRlL3NtYXJ0LXRhYmxlL3BhZ2luYXRpb25leHRyYS5odG1sJyxcclxuICAgICAgICAne3tmaXJzdEl0ZW19fSB0byB7e2xhc3RJdGVtfX0gb2Yge3t0b3RhbEl0ZW1zfX0nKTtcdFxyXG4gICAgJHRlbXBsYXRlQ2FjaGUucHV0KCd0ZW1wbGF0ZS9zbWFydC10YWJsZS9wYWdpbmF0aW9udG90YWwuaHRtbCcsXHJcbiAgICAgICAgJ3t7bGltaXRJdGVtc319IG9mIHt7dG90YWxJdGVtc319Jyk7XHRcclxufV0pO1xyXG5cclxuIiwibmcubW9kdWxlKCdzbWFydC10YWJsZScpXHJcbiAgLmNvbnRyb2xsZXIoJ3N0VGFibGVDb250cm9sbGVyJywgWyckc2NvcGUnLCAnJHBhcnNlJywgJyRmaWx0ZXInLCAnJGF0dHJzJywgZnVuY3Rpb24gU3RUYWJsZUNvbnRyb2xsZXIoJHNjb3BlLCAkcGFyc2UsICRmaWx0ZXIsICRhdHRycykge1xyXG4gICAgdmFyIHByb3BlcnR5TmFtZSA9ICRhdHRycy5zdFRhYmxlO1xyXG4gICAgdmFyIGRpc3BsYXlHZXR0ZXIgPSAkcGFyc2UocHJvcGVydHlOYW1lKTtcclxuICAgIHZhciBkaXNwbGF5U2V0dGVyID0gZGlzcGxheUdldHRlci5hc3NpZ247XHJcbiAgICB2YXIgc2FmZUdldHRlcjtcclxuICAgIHZhciBvcmRlckJ5ID0gJGZpbHRlcignb3JkZXJCeScpO1xyXG4gICAgdmFyIGZpbHRlciA9ICRmaWx0ZXIoJ2ZpbHRlcicpO1xyXG4gICAgdmFyIHNhZmVDb3B5ID0gY29weVJlZnMoZGlzcGxheUdldHRlcigkc2NvcGUpKTtcclxuICAgIHZhciB0YWJsZVN0YXRlID0ge1xyXG4gICAgICBzb3J0OiB7fSxcclxuICAgICAgc2VhcmNoOiB7fSxcclxuICAgICAgcGFnaW5hdGlvbjoge1xyXG4gICAgICAgIHN0YXJ0OiAwXHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgICB2YXIgcGlwZUFmdGVyU2FmZUNvcHkgPSB0cnVlO1xyXG4gICAgdmFyIGN0cmwgPSB0aGlzO1xyXG4gICAgdmFyIGxhc3RTZWxlY3RlZDtcclxuXHJcbiAgICBmdW5jdGlvbiBjb3B5UmVmcyhzcmMpIHtcclxuICAgICAgcmV0dXJuIHNyYyA/IFtdLmNvbmNhdChzcmMpIDogW107XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gdXBkYXRlU2FmZUNvcHkoKSB7XHJcbiAgICAgIHNhZmVDb3B5ID0gY29weVJlZnMoc2FmZUdldHRlcigkc2NvcGUpKTtcclxuICAgICAgaWYgKHBpcGVBZnRlclNhZmVDb3B5ID09PSB0cnVlKSB7XHJcbiAgICAgICAgY3RybC5waXBlKCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAoJGF0dHJzLnN0U2FmZVNyYykge1xyXG4gICAgICBzYWZlR2V0dGVyID0gJHBhcnNlKCRhdHRycy5zdFNhZmVTcmMpO1xyXG4gICAgICAkc2NvcGUuJHdhdGNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgc2FmZVNyYyA9IHNhZmVHZXR0ZXIoJHNjb3BlKTtcclxuICAgICAgICByZXR1cm4gc2FmZVNyYyA/IHNhZmVTcmMubGVuZ3RoIDogMDtcclxuXHJcbiAgICAgIH0sIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcclxuICAgICAgICBpZiAobmV3VmFsdWUgIT09IHNhZmVDb3B5Lmxlbmd0aCkge1xyXG4gICAgICAgICAgdXBkYXRlU2FmZUNvcHkoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgICAkc2NvcGUuJHdhdGNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gc2FmZUdldHRlcigkc2NvcGUpO1xyXG4gICAgICB9LCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XHJcbiAgICAgICAgaWYgKG5ld1ZhbHVlICE9PSBvbGRWYWx1ZSkge1xyXG4gICAgICAgICAgdXBkYXRlU2FmZUNvcHkoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuXHQvL01DIHRoaXMgaXMgaG9ycmlibGUgYnV0IGEgd2F5IG9mIGdldHRpbmcgYWNjZXNzIHRvIHRoZSB2YWx1ZSB0byBzZWUgaWYgaXQncyBiZWVuIGluaXRpYWxpemVkIGluIHRoZSBkaXJlY3RpdmVcclxuXHR0aGlzLm1vZGVsVmFsID0gZnVuY3Rpb24gbW9kZWxWYWwod2hpY2htb2RlbCwgZW5kdmFsKSB7XHJcblx0XHRpZiAoYW5ndWxhci5pc0RlZmluZWQod2hpY2htb2RlbCkgJiYgKHdoaWNobW9kZWwgIT09IG51bGwpKVxyXG5cdFx0e1xyXG5cdFx0XHR2YXIgZmluZERvdCA9IHdoaWNobW9kZWwuaW5kZXhPZignLicpO1xyXG5cdFx0XHRpZiAoZmluZERvdCAhPT0gLTEpXHJcblx0XHRcdHtcclxuXHRcdFx0XHR2YXIgY3RybHIgPSB3aGljaG1vZGVsLnN1YnN0cigwLGZpbmREb3QpO1xyXG5cdFx0XHRcdHZhciB2YXJibCA9IHdoaWNobW9kZWwuc3Vic3RyKGZpbmREb3QrMSk7XHJcblx0XHRcdFx0aWYgKGFuZ3VsYXIuaXNEZWZpbmVkKCRzY29wZVtjdHJscl1bdmFyYmxdKSlcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRpZiAoZW5kdmFsID09PSBudWxsKVxyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gJHNjb3BlW2N0cmxyXVt2YXJibF07XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoJHNjb3BlW2N0cmxyXVt2YXJibF0gPT09IG51bGwpXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKGFuZ3VsYXIuaXNEZWZpbmVkKCRzY29wZVtjdHJscl1bdmFyYmxdW2VuZHZhbF0pKVxyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gJHNjb3BlW2N0cmxyXVt2YXJibF1bZW5kdmFsXTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdHJldHVybiBudWxsO1xyXG5cdH07ICAgIFxyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIHNvcnQgdGhlIHJvd3NcclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb24gfCBTdHJpbmd9IHByZWRpY2F0ZSAtIGZ1bmN0aW9uIG9yIHN0cmluZyB3aGljaCB3aWxsIGJlIHVzZWQgYXMgcHJlZGljYXRlIGZvciB0aGUgc29ydGluZ1xyXG4gICAgICogQHBhcmFtIFtyZXZlcnNlXSAtIGlmIHlvdSB3YW50IHRvIHJldmVyc2UgdGhlIG9yZGVyXHJcbiAgICAgKi9cclxuICAgIHRoaXMuc29ydEJ5ID0gZnVuY3Rpb24gc29ydEJ5KHByZWRpY2F0ZSwgcmV2ZXJzZSkge1xyXG4gICAgICB0YWJsZVN0YXRlLnNvcnQucHJlZGljYXRlID0gcHJlZGljYXRlO1xyXG4gICAgICB0YWJsZVN0YXRlLnNvcnQucmV2ZXJzZSA9IHJldmVyc2UgPT09IHRydWU7XHJcblxyXG4gICAgICBpZiAobmcuaXNGdW5jdGlvbihwcmVkaWNhdGUpKSB7XHJcbiAgICAgICAgdGFibGVTdGF0ZS5zb3J0LmZ1bmN0aW9uTmFtZSA9IHByZWRpY2F0ZS5uYW1lO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGRlbGV0ZSB0YWJsZVN0YXRlLnNvcnQuZnVuY3Rpb25OYW1lO1xyXG4gICAgICB9XHJcblxyXG4gICAgICB0YWJsZVN0YXRlLnBhZ2luYXRpb24uc3RhcnQgPSAwO1xyXG4gICAgICByZXR1cm4gdGhpcy5waXBlKCk7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogc2VhcmNoIG1hdGNoaW5nIHJvd3NcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBpbnB1dCAtIHRoZSBpbnB1dCBzdHJpbmdcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBbcHJlZGljYXRlXSAtIHRoZSBwcm9wZXJ0eSBuYW1lIGFnYWluc3QgeW91IHdhbnQgdG8gY2hlY2sgdGhlIG1hdGNoLCBvdGhlcndpc2UgaXQgd2lsbCBzZWFyY2ggb24gYWxsIHByb3BlcnRpZXNcclxuICAgICAqL1xyXG4gICAgdGhpcy5zZWFyY2ggPSBmdW5jdGlvbiBzZWFyY2goaW5wdXQsIHByZWRpY2F0ZSkge1xyXG4gICAgICB2YXIgcHJlZGljYXRlT2JqZWN0ID0gdGFibGVTdGF0ZS5zZWFyY2gucHJlZGljYXRlT2JqZWN0IHx8IHt9O1xyXG4gICAgICB2YXIgcHJvcCA9IHByZWRpY2F0ZSA/IHByZWRpY2F0ZSA6ICckJztcclxuXHJcbiAgICAgIGlucHV0ID0gbmcuaXNTdHJpbmcoaW5wdXQpID8gaW5wdXQudHJpbSgpIDogaW5wdXQ7XHJcbiAgICAgIHByZWRpY2F0ZU9iamVjdFtwcm9wXSA9IGlucHV0O1xyXG4gICAgICAvLyB0byBhdm9pZCB0byBmaWx0ZXIgb3V0IG51bGwgdmFsdWVcclxuICAgICAgaWYgKCFpbnB1dCkge1xyXG4gICAgICAgIGRlbGV0ZSBwcmVkaWNhdGVPYmplY3RbcHJvcF07XHJcbiAgICAgIH1cclxuICAgICAgdGFibGVTdGF0ZS5zZWFyY2gucHJlZGljYXRlT2JqZWN0ID0gcHJlZGljYXRlT2JqZWN0O1xyXG4gICAgICB0YWJsZVN0YXRlLnBhZ2luYXRpb24uc3RhcnQgPSAwO1xyXG4gICAgICByZXR1cm4gdGhpcy5waXBlKCk7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogdGhpcyB3aWxsIGNoYWluIHRoZSBvcGVyYXRpb25zIG9mIHNvcnRpbmcgYW5kIGZpbHRlcmluZyBiYXNlZCBvbiB0aGUgY3VycmVudCB0YWJsZSBzdGF0ZSAoc29ydCBvcHRpb25zLCBmaWx0ZXJpbmcsIGVjdClcclxuICAgICAqL1xyXG4gICAgdGhpcy5waXBlID0gZnVuY3Rpb24gcGlwZSgpIHtcclxuICAgICAgdmFyIHBhZ2luYXRpb24gPSB0YWJsZVN0YXRlLnBhZ2luYXRpb247XHJcbiAgICAgIHZhciBmaWx0ZXJlZCA9IHRhYmxlU3RhdGUuc2VhcmNoLnByZWRpY2F0ZU9iamVjdCA/IGZpbHRlcihzYWZlQ29weSwgdGFibGVTdGF0ZS5zZWFyY2gucHJlZGljYXRlT2JqZWN0KSA6IHNhZmVDb3B5O1xyXG4gICAgICBpZiAodGFibGVTdGF0ZS5zb3J0LnByZWRpY2F0ZSkge1xyXG4gICAgICAgIGZpbHRlcmVkID0gb3JkZXJCeShmaWx0ZXJlZCwgdGFibGVTdGF0ZS5zb3J0LnByZWRpY2F0ZSwgdGFibGVTdGF0ZS5zb3J0LnJldmVyc2UpO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICAvL01DIHJlY29yZCB0b3RhbCBvZiBmaWx0ZXJlZCBpdGVtc1xyXG4gICAgICBwYWdpbmF0aW9uLnRvdGFsID0gZmlsdGVyZWQubGVuZ3RoO1xyXG4gICAgICBcclxuICAgICAgaWYgKHBhZ2luYXRpb24ubnVtYmVyICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICBwYWdpbmF0aW9uLm51bWJlck9mUGFnZXMgPSBmaWx0ZXJlZC5sZW5ndGggPiAwID8gTWF0aC5jZWlsKGZpbHRlcmVkLmxlbmd0aCAvIHBhZ2luYXRpb24ubnVtYmVyKSA6IDE7XHJcbiAgICAgICAgcGFnaW5hdGlvbi5zdGFydCA9IHBhZ2luYXRpb24uc3RhcnQgPj0gZmlsdGVyZWQubGVuZ3RoID8gKHBhZ2luYXRpb24ubnVtYmVyT2ZQYWdlcyAtIDEpICogcGFnaW5hdGlvbi5udW1iZXIgOiBwYWdpbmF0aW9uLnN0YXJ0O1xyXG4gICAgICAgIGZpbHRlcmVkID0gZmlsdGVyZWQuc2xpY2UocGFnaW5hdGlvbi5zdGFydCwgcGFnaW5hdGlvbi5zdGFydCArIHBhcnNlSW50KHBhZ2luYXRpb24ubnVtYmVyKSk7XHJcbiAgICAgIH1cclxuICAgICAgZGlzcGxheVNldHRlcigkc2NvcGUsIGZpbHRlcmVkKTtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBzZWxlY3QgYSBkYXRhUm93IChpdCB3aWxsIGFkZCB0aGUgYXR0cmlidXRlIGlzU2VsZWN0ZWQgdG8gdGhlIHJvdyBvYmplY3QpXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcm93IC0gdGhlIHJvdyB0byBzZWxlY3RcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBbbW9kZV0gLSBcInNpbmdsZVwiIG9yIFwibXVsdGlwbGVcIiAobXVsdGlwbGUgYnkgZGVmYXVsdClcclxuICAgICAqL1xyXG4gICAgdGhpcy5zZWxlY3QgPSBmdW5jdGlvbiBzZWxlY3Qocm93LCBtb2RlKSB7XHJcbiAgICAgIHZhciByb3dzID0gc2FmZUNvcHk7XHJcbiAgICAgIHZhciBpbmRleCA9IHJvd3MuaW5kZXhPZihyb3cpO1xyXG4gICAgICBpZiAoaW5kZXggIT09IC0xKSB7XHJcbiAgICAgICAgaWYgKG1vZGUgPT09ICdzaW5nbGUnKSB7XHJcbiAgICAgICAgICByb3cuaXNTZWxlY3RlZCA9IHJvdy5pc1NlbGVjdGVkICE9PSB0cnVlO1xyXG4gICAgICAgICAgaWYgKGxhc3RTZWxlY3RlZCkge1xyXG4gICAgICAgICAgICBsYXN0U2VsZWN0ZWQuaXNTZWxlY3RlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgbGFzdFNlbGVjdGVkID0gcm93LmlzU2VsZWN0ZWQgPT09IHRydWUgPyByb3cgOiB1bmRlZmluZWQ7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHJvd3NbaW5kZXhdLmlzU2VsZWN0ZWQgPSAhcm93c1tpbmRleF0uaXNTZWxlY3RlZDtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiB0YWtlIGEgc2xpY2Ugb2YgdGhlIGN1cnJlbnQgc29ydGVkL2ZpbHRlcmVkIGNvbGxlY3Rpb24gKHBhZ2luYXRpb24pXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHN0YXJ0IC0gc3RhcnQgaW5kZXggb2YgdGhlIHNsaWNlXHJcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gbnVtYmVyIC0gdGhlIG51bWJlciBvZiBpdGVtIGluIHRoZSBzbGljZVxyXG4gICAgICovXHJcbiAgICB0aGlzLnNsaWNlID0gZnVuY3Rpb24gc3BsaWNlKHN0YXJ0LCBudW1iZXIpIHtcclxuICAgICAgdGFibGVTdGF0ZS5wYWdpbmF0aW9uLnN0YXJ0ID0gc3RhcnQ7XHJcbiAgICAgIHRhYmxlU3RhdGUucGFnaW5hdGlvbi5udW1iZXIgPSBudW1iZXI7XHJcbiAgICAgIHJldHVybiB0aGlzLnBpcGUoKTtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiByZXR1cm4gdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlIHRhYmxlXHJcbiAgICAgKiBAcmV0dXJucyB7e3NvcnQ6IHt9LCBzZWFyY2g6IHt9LCBwYWdpbmF0aW9uOiB7c3RhcnQ6IG51bWJlcn19fVxyXG4gICAgICovXHJcbiAgICB0aGlzLnRhYmxlU3RhdGUgPSBmdW5jdGlvbiBnZXRUYWJsZVN0YXRlKCkge1xyXG4gICAgICByZXR1cm4gdGFibGVTdGF0ZTtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBVc2UgYSBkaWZmZXJlbnQgZmlsdGVyIGZ1bmN0aW9uIHRoYW4gdGhlIGFuZ3VsYXIgRmlsdGVyRmlsdGVyXHJcbiAgICAgKiBAcGFyYW0gZmlsdGVyTmFtZSB0aGUgbmFtZSB1bmRlciB3aGljaCB0aGUgY3VzdG9tIGZpbHRlciBpcyByZWdpc3RlcmVkXHJcbiAgICAgKi9cclxuICAgIHRoaXMuc2V0RmlsdGVyRnVuY3Rpb24gPSBmdW5jdGlvbiBzZXRGaWx0ZXJGdW5jdGlvbihmaWx0ZXJOYW1lKSB7XHJcbiAgICAgIGZpbHRlciA9ICRmaWx0ZXIoZmlsdGVyTmFtZSk7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICpVc2VyIGEgZGlmZmVyZW50IGZ1bmN0aW9uIHRoYW4gdGhlIGFuZ3VsYXIgb3JkZXJCeVxyXG4gICAgICogQHBhcmFtIHNvcnRGdW5jdGlvbk5hbWUgdGhlIG5hbWUgdW5kZXIgd2hpY2ggdGhlIGN1c3RvbSBvcmRlciBmdW5jdGlvbiBpcyByZWdpc3RlcmVkXHJcbiAgICAgKi9cclxuICAgIHRoaXMuc2V0U29ydEZ1bmN0aW9uID0gZnVuY3Rpb24gc2V0U29ydEZ1bmN0aW9uKHNvcnRGdW5jdGlvbk5hbWUpIHtcclxuICAgICAgb3JkZXJCeSA9ICRmaWx0ZXIoc29ydEZ1bmN0aW9uTmFtZSk7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVXN1YWxseSB3aGVuIHRoZSBzYWZlIGNvcHkgaXMgdXBkYXRlZCB0aGUgcGlwZSBmdW5jdGlvbiBpcyBjYWxsZWQuXHJcbiAgICAgKiBDYWxsaW5nIHRoaXMgbWV0aG9kIHdpbGwgcHJldmVudCBpdCwgd2hpY2ggaXMgc29tZXRoaW5nIHJlcXVpcmVkIHdoZW4gdXNpbmcgYSBjdXN0b20gcGlwZSBmdW5jdGlvblxyXG4gICAgICovXHJcbiAgICB0aGlzLnByZXZlbnRQaXBlT25XYXRjaCA9IGZ1bmN0aW9uIHByZXZlbnRQaXBlKCkge1xyXG4gICAgICBwaXBlQWZ0ZXJTYWZlQ29weSA9IGZhbHNlO1xyXG4gICAgfTtcclxuICB9XSlcclxuICAuZGlyZWN0aXZlKCdzdFRhYmxlJywgZnVuY3Rpb24gKCkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgcmVzdHJpY3Q6ICdBJyxcclxuICAgICAgY29udHJvbGxlcjogJ3N0VGFibGVDb250cm9sbGVyJyxcclxuICAgICAgbGluazogZnVuY3Rpb24gKHNjb3BlLCBlbGVtZW50LCBhdHRyLCBjdHJsKSB7XHJcblxyXG4gICAgICAgIGlmIChhdHRyLnN0U2V0RmlsdGVyKSB7XHJcbiAgICAgICAgICBjdHJsLnNldEZpbHRlckZ1bmN0aW9uKGF0dHIuc3RTZXRGaWx0ZXIpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGF0dHIuc3RTZXRTb3J0KSB7XHJcbiAgICAgICAgICBjdHJsLnNldFNvcnRGdW5jdGlvbihhdHRyLnN0U2V0U29ydCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gIH0pO1xyXG4iLCJuZy5tb2R1bGUoJ3NtYXJ0LXRhYmxlJylcclxuICAgIC5kaXJlY3RpdmUoJ3N0U2VhcmNoJywgWyckdGltZW91dCcsIGZ1bmN0aW9uICgkdGltZW91dCkge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHJlcXVpcmU6ICdec3RUYWJsZScsXHJcbiAgICAgICAgICAgIHNjb3BlOiB7XHJcbiAgICAgICAgICAgICAgICBwcmVkaWNhdGU6ICc9P3N0U2VhcmNoJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBsaW5rOiBmdW5jdGlvbiAoc2NvcGUsIGVsZW1lbnQsIGF0dHIsIGN0cmwpIHtcclxuICAgICAgICAgICAgICAgIHZhciB0YWJsZUN0cmwgPSBjdHJsO1xyXG4gICAgICAgICAgICAgICAgdmFyIHByb21pc2UgPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgdmFyIHRocm90dGxlID0gYXR0ci5zdERlbGF5IHx8IDQwMDtcclxuXHJcblx0XHQvL01DIGluaXRpYWxpemUgdGhlIHNlYXJjaCBpZiB2YWx1ZXMgc2V0IGZvciBvdXIgbW9kZWxcclxuXHRcdHZhciBlbmR2YWwgPSBudWxsO1xyXG5cdFx0aWYgKGFuZ3VsYXIuaXNEZWZpbmVkKGF0dHIubmdPcHRpb25zKSlcclxuXHRcdHtcclxuXHRcdFx0dmFyIGZpbmREb3QgPSBhdHRyLm5nT3B0aW9ucy5sYXN0SW5kZXhPZignLicpO1xyXG5cdFx0XHRpZiAoZmluZERvdCAhPT0gLTEpXHJcblx0XHRcdHtcclxuXHRcdFx0XHRlbmR2YWwgPSBhdHRyLm5nT3B0aW9ucy5zdWJzdHIoZmluZERvdCArIDEpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHQgICAgXHJcblx0XHR2YXIgaW5pdFZhbCA9IGN0cmwubW9kZWxWYWwoYXR0ci5uZ01vZGVsLCBlbmR2YWwpO1xyXG5cdFx0aWYgKGluaXRWYWwgIT09IG51bGwpXHJcblx0XHR7XHJcblx0XHRcdHRhYmxlQ3RybC5zZWFyY2goaW5pdFZhbCwgc2NvcGUucHJlZGljYXRlIHx8ICcnKTtcclxuXHRcdH1cclxuXHRcdCAgICBcclxuICAgICAgICAgICAgICAgIHNjb3BlLiR3YXRjaCgncHJlZGljYXRlJywgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChuZXdWYWx1ZSAhPT0gb2xkVmFsdWUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY3RybC50YWJsZVN0YXRlKCkuc2VhcmNoID0ge307XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhYmxlQ3RybC5zZWFyY2goZWxlbWVudFswXS52YWx1ZSB8fCAnJywgbmV3VmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vdGFibGUgc3RhdGUgLT4gdmlld1xyXG4gICAgICAgICAgICAgICAgc2NvcGUuJHdhdGNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY3RybC50YWJsZVN0YXRlKCkuc2VhcmNoO1xyXG4gICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBwcmVkaWNhdGVFeHByZXNzaW9uID0gc2NvcGUucHJlZGljYXRlIHx8ICckJztcclxuICAgICAgICAgICAgICAgICAgICBpZiAobmV3VmFsdWUucHJlZGljYXRlT2JqZWN0ICYmIG5ld1ZhbHVlLnByZWRpY2F0ZU9iamVjdFtwcmVkaWNhdGVFeHByZXNzaW9uXSAhPT0gZWxlbWVudFswXS52YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50WzBdLnZhbHVlID0gbmV3VmFsdWUucHJlZGljYXRlT2JqZWN0W3ByZWRpY2F0ZUV4cHJlc3Npb25dIHx8ICcnO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sIHRydWUpO1xyXG5cclxuXHRcdGZ1bmN0aW9uIHNlYXJjaEZpbHRlcihldnQpIHtcclxuXHRcdCAgICBldnQgPSBldnQub3JpZ2luYWxFdmVudCB8fCBldnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb21pc2UgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJHRpbWVvdXQuY2FuY2VsKHByb21pc2UpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBwcm9taXNlID0gJHRpbWVvdXQoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0YWJsZUN0cmwuc2VhcmNoKGV2dC50YXJnZXQudmFsdWUsIHNjb3BlLnByZWRpY2F0ZSB8fCAnJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb21pc2UgPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sIHRocm90dGxlKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHRcdFxyXG4gICAgICAgICAgICAgICAgLy8gdmlldyAtPiB0YWJsZSBzdGF0ZVxyXG5cdFx0aWYgKGVsZW1lbnQucHJvcCgndGFnTmFtZScpID09ICdTRUxFQ1QnKSB7XHJcblx0XHRcdGVsZW1lbnQuYmluZCgnY2hhbmdlJywgc2VhcmNoRmlsdGVyKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGVsZW1lbnQuYmluZCgnaW5wdXQnLCBzZWFyY2hGaWx0ZXIpO1xyXG5cdFx0fVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuICAgIH1dKTtcclxuIiwibmcubW9kdWxlKCdzbWFydC10YWJsZScpXHJcbiAgLmRpcmVjdGl2ZSgnc3RTZWxlY3RSb3cnLCBmdW5jdGlvbiAoKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICByZXN0cmljdDogJ0EnLFxyXG4gICAgICByZXF1aXJlOiAnXnN0VGFibGUnLFxyXG4gICAgICBzY29wZToge1xyXG4gICAgICAgIHJvdzogJz1zdFNlbGVjdFJvdydcclxuICAgICAgfSxcclxuICAgICAgbGluazogZnVuY3Rpb24gKHNjb3BlLCBlbGVtZW50LCBhdHRyLCBjdHJsKSB7XHJcbiAgICAgICAgdmFyIG1vZGUgPSBhdHRyLnN0U2VsZWN0TW9kZSB8fCAnc2luZ2xlJztcclxuICAgICAgICBlbGVtZW50LmJpbmQoJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgc2NvcGUuJGFwcGx5KGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgY3RybC5zZWxlY3Qoc2NvcGUucm93LCBtb2RlKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBzY29wZS4kd2F0Y2goJ3Jvdy5pc1NlbGVjdGVkJywgZnVuY3Rpb24gKG5ld1ZhbHVlKSB7XHJcbiAgICAgICAgICBpZiAobmV3VmFsdWUgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgZWxlbWVudC5hZGRDbGFzcygnc3Qtc2VsZWN0ZWQnKTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGVsZW1lbnQucmVtb3ZlQ2xhc3MoJ3N0LXNlbGVjdGVkJyk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgfSk7XHJcbiIsIm5nLm1vZHVsZSgnc21hcnQtdGFibGUnKVxyXG4gIC5kaXJlY3RpdmUoJ3N0U29ydCcsIFsnJHBhcnNlJywgZnVuY3Rpb24gKCRwYXJzZSkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgcmVzdHJpY3Q6ICdBJyxcclxuICAgICAgcmVxdWlyZTogJ15zdFRhYmxlJyxcclxuICAgICAgbGluazogZnVuY3Rpb24gKHNjb3BlLCBlbGVtZW50LCBhdHRyLCBjdHJsKSB7XHJcblxyXG4gICAgICAgIHZhciBwcmVkaWNhdGUgPSBhdHRyLnN0U29ydDtcclxuICAgICAgICB2YXIgZ2V0dGVyID0gJHBhcnNlKHByZWRpY2F0ZSk7XHJcbiAgICAgICAgdmFyIGluZGV4ID0gMDtcclxuICAgICAgICB2YXIgY2xhc3NBc2NlbnQgPSBhdHRyLnN0Q2xhc3NBc2NlbnQgfHwgJ3N0LXNvcnQtYXNjZW50JztcclxuICAgICAgICB2YXIgY2xhc3NEZXNjZW50ID0gYXR0ci5zdENsYXNzRGVzY2VudCB8fCAnc3Qtc29ydC1kZXNjZW50JztcclxuICAgICAgICB2YXIgc3RhdGVDbGFzc2VzID0gW2NsYXNzQXNjZW50LCBjbGFzc0Rlc2NlbnRdO1xyXG4gICAgICAgIHZhciBzb3J0RGVmYXVsdDtcclxuXHJcbiAgICAgICAgaWYgKGF0dHIuc3RTb3J0RGVmYXVsdCkge1xyXG4gICAgICAgICAgc29ydERlZmF1bHQgPSBzY29wZS4kZXZhbChhdHRyLnN0U29ydERlZmF1bHQpICE9PSB1bmRlZmluZWQgPyAgc2NvcGUuJGV2YWwoYXR0ci5zdFNvcnREZWZhdWx0KSA6IGF0dHIuc3RTb3J0RGVmYXVsdDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vdmlldyAtLT4gdGFibGUgc3RhdGVcclxuICAgICAgICBmdW5jdGlvbiBzb3J0KCkge1xyXG4gICAgICAgICAgaW5kZXgrKztcclxuICAgICAgICAgIHByZWRpY2F0ZSA9IG5nLmlzRnVuY3Rpb24oZ2V0dGVyKHNjb3BlKSkgPyBnZXR0ZXIoc2NvcGUpIDogYXR0ci5zdFNvcnQ7XHJcbiAgICAgICAgICBpZiAoaW5kZXggJSAzID09PSAwICYmIGF0dHIuc3RTa2lwTmF0dXJhbCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIC8vbWFudWFsIHJlc2V0XHJcbiAgICAgICAgICAgIGluZGV4ID0gMDtcclxuICAgICAgICAgICAgY3RybC50YWJsZVN0YXRlKCkuc29ydCA9IHt9O1xyXG4gICAgICAgICAgICBjdHJsLnRhYmxlU3RhdGUoKS5wYWdpbmF0aW9uLnN0YXJ0ID0gMDtcclxuICAgICAgICAgICAgY3RybC5waXBlKCk7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjdHJsLnNvcnRCeShwcmVkaWNhdGUsIGluZGV4ICUgMiA9PT0gMCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBlbGVtZW50LmJpbmQoJ2NsaWNrJywgZnVuY3Rpb24gc29ydENsaWNrKCkge1xyXG4gICAgICAgICAgaWYgKHByZWRpY2F0ZSkge1xyXG4gICAgICAgICAgICBzY29wZS4kYXBwbHkoc29ydCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGlmIChzb3J0RGVmYXVsdCkge1xyXG4gICAgICAgICAgaW5kZXggPSBhdHRyLnN0U29ydERlZmF1bHQgPT09ICdyZXZlcnNlJyA/IDEgOiAwO1xyXG4gICAgICAgICAgc29ydCgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy90YWJsZSBzdGF0ZSAtLT4gdmlld1xyXG4gICAgICAgIHNjb3BlLiR3YXRjaChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICByZXR1cm4gY3RybC50YWJsZVN0YXRlKCkuc29ydDtcclxuICAgICAgICB9LCBmdW5jdGlvbiAobmV3VmFsdWUpIHtcclxuICAgICAgICAgIGlmIChuZXdWYWx1ZS5wcmVkaWNhdGUgIT09IHByZWRpY2F0ZSkge1xyXG4gICAgICAgICAgICBpbmRleCA9IDA7XHJcbiAgICAgICAgICAgIGVsZW1lbnRcclxuICAgICAgICAgICAgICAucmVtb3ZlQ2xhc3MoY2xhc3NBc2NlbnQpXHJcbiAgICAgICAgICAgICAgLnJlbW92ZUNsYXNzKGNsYXNzRGVzY2VudCk7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBpbmRleCA9IG5ld1ZhbHVlLnJldmVyc2UgPT09IHRydWUgPyAyIDogMTtcclxuICAgICAgICAgICAgZWxlbWVudFxyXG4gICAgICAgICAgICAgIC5yZW1vdmVDbGFzcyhzdGF0ZUNsYXNzZXNbaW5kZXggJSAyXSlcclxuICAgICAgICAgICAgICAuYWRkQ2xhc3Moc3RhdGVDbGFzc2VzW2luZGV4IC0gMV0pO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sIHRydWUpO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gIH1dKTtcclxuIiwibmcubW9kdWxlKCdzbWFydC10YWJsZScpXHJcbiAgLmRpcmVjdGl2ZSgnc3RQYWdpbmF0aW9uJywgZnVuY3Rpb24gKCkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgcmVzdHJpY3Q6ICdFQScsXHJcbiAgICAgIHJlcXVpcmU6ICdec3RUYWJsZScsXHJcbiAgICAgIHNjb3BlOiB7XHJcbiAgICAgICAgc3RJdGVtc0J5UGFnZTogJz0/JyxcclxuICAgICAgICBzdERpc3BsYXllZFBhZ2VzOiAnPT8nLFxyXG4gICAgICAgIHN0UGFnZUNoYW5nZTogJyYnXHJcbiAgICAgIH0sXHJcbiAgICAgIHRlbXBsYXRlVXJsOiBmdW5jdGlvbiAoZWxlbWVudCwgYXR0cnMpIHtcclxuICAgICAgICBpZiAoYXR0cnMuc3RUZW1wbGF0ZSkge1xyXG4gICAgICAgICAgcmV0dXJuIGF0dHJzLnN0VGVtcGxhdGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiAndGVtcGxhdGUvc21hcnQtdGFibGUvcGFnaW5hdGlvbi5odG1sJztcclxuICAgICAgfSxcclxuICAgICAgbGluazogZnVuY3Rpb24gKHNjb3BlLCBlbGVtZW50LCBhdHRycywgY3RybCkge1xyXG5cclxuICAgICAgICBzY29wZS5zdEl0ZW1zQnlQYWdlID0gc2NvcGUuc3RJdGVtc0J5UGFnZSA/ICsoc2NvcGUuc3RJdGVtc0J5UGFnZSkgOiAxMDtcclxuICAgICAgICBzY29wZS5zdERpc3BsYXllZFBhZ2VzID0gc2NvcGUuc3REaXNwbGF5ZWRQYWdlcyA/ICsoc2NvcGUuc3REaXNwbGF5ZWRQYWdlcykgOiA1O1xyXG5cclxuICAgICAgICBzY29wZS5jdXJyZW50UGFnZSA9IDE7XHJcbiAgICAgICAgc2NvcGUucGFnZXMgPSBbXTtcclxuXHJcbiAgICAgICAgZnVuY3Rpb24gcmVkcmF3KCkge1xyXG4gICAgICAgICAgdmFyIHBhZ2luYXRpb25TdGF0ZSA9IGN0cmwudGFibGVTdGF0ZSgpLnBhZ2luYXRpb247XHJcbiAgICAgICAgICB2YXIgc3RhcnQgPSAxO1xyXG4gICAgICAgICAgdmFyIGVuZDtcclxuICAgICAgICAgIHZhciBpO1xyXG4gICAgICAgICAgdmFyIHByZXZQYWdlID0gc2NvcGUuY3VycmVudFBhZ2U7XHJcbiAgICAgICAgICBzY29wZS5jdXJyZW50UGFnZSA9IE1hdGguZmxvb3IocGFnaW5hdGlvblN0YXRlLnN0YXJ0IC8gcGFnaW5hdGlvblN0YXRlLm51bWJlcikgKyAxO1xyXG5cclxuICAgICAgICAgIHN0YXJ0ID0gTWF0aC5tYXgoc3RhcnQsIHNjb3BlLmN1cnJlbnRQYWdlIC0gTWF0aC5hYnMoTWF0aC5mbG9vcihzY29wZS5zdERpc3BsYXllZFBhZ2VzIC8gMikpKTtcclxuICAgICAgICAgIGVuZCA9IHN0YXJ0ICsgc2NvcGUuc3REaXNwbGF5ZWRQYWdlcztcclxuXHJcbiAgICAgICAgICBpZiAoZW5kID4gcGFnaW5hdGlvblN0YXRlLm51bWJlck9mUGFnZXMpIHtcclxuICAgICAgICAgICAgZW5kID0gcGFnaW5hdGlvblN0YXRlLm51bWJlck9mUGFnZXMgKyAxO1xyXG4gICAgICAgICAgICBzdGFydCA9IE1hdGgubWF4KDEsIGVuZCAtIHNjb3BlLnN0RGlzcGxheWVkUGFnZXMpO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIHNjb3BlLnBhZ2VzID0gW107XHJcbiAgICAgICAgICBzY29wZS5udW1QYWdlcyA9IHBhZ2luYXRpb25TdGF0ZS5udW1iZXJPZlBhZ2VzO1xyXG5cclxuICAgICAgICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcclxuICAgICAgICAgICAgc2NvcGUucGFnZXMucHVzaChpKTtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICBpZiAocHJldlBhZ2UhPT1zY29wZS5jdXJyZW50UGFnZSkge1xyXG4gICAgICAgICAgICBzY29wZS5zdFBhZ2VDaGFuZ2Uoe25ld1BhZ2U6IHNjb3BlLmN1cnJlbnRQYWdlfSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL3RhYmxlIHN0YXRlIC0tPiB2aWV3XHJcbiAgICAgICAgc2NvcGUuJHdhdGNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgIHJldHVybiBjdHJsLnRhYmxlU3RhdGUoKS5wYWdpbmF0aW9uO1xyXG4gICAgICAgIH0sIHJlZHJhdywgdHJ1ZSk7XHJcblxyXG4gICAgICAgIC8vc2NvcGUgLS0+IHRhYmxlIHN0YXRlICAoLS0+IHZpZXcpXHJcbiAgICAgICAgc2NvcGUuJHdhdGNoKCdzdEl0ZW1zQnlQYWdlJywgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xyXG4gICAgICAgICAgaWYgKG5ld1ZhbHVlICE9PSBvbGRWYWx1ZSkge1xyXG4gICAgICAgICAgICBzY29wZS5zZWxlY3RQYWdlKDEpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBzY29wZS4kd2F0Y2goJ3N0RGlzcGxheWVkUGFnZXMnLCByZWRyYXcpO1xyXG5cclxuICAgICAgICAvL3ZpZXcgLT4gdGFibGUgc3RhdGVcclxuICAgICAgICBzY29wZS5zZWxlY3RQYWdlID0gZnVuY3Rpb24gKHBhZ2UpIHtcclxuICAgICAgICAgIGlmIChwYWdlID4gMCAmJiBwYWdlIDw9IHNjb3BlLm51bVBhZ2VzKSB7XHJcbiAgICAgICAgICAgIGN0cmwuc2xpY2UoKHBhZ2UgLSAxKSAqIHNjb3BlLnN0SXRlbXNCeVBhZ2UsIHNjb3BlLnN0SXRlbXNCeVBhZ2UpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmKCFjdHJsLnRhYmxlU3RhdGUoKS5wYWdpbmF0aW9uLm51bWJlcil7XHJcbiAgICAgICAgICBjdHJsLnNsaWNlKDAsIHNjb3BlLnN0SXRlbXNCeVBhZ2UpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfTtcclxuICB9KTtcclxuIiwibmcubW9kdWxlKCdzbWFydC10YWJsZScpXHJcbiAgLmRpcmVjdGl2ZSgnc3RQYWdpbmF0aW9uRXh0cmEnLCBmdW5jdGlvbiAoKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICByZXN0cmljdDogJ0VBJyxcclxuICAgICAgcmVxdWlyZTogJ15zdFRhYmxlJyxcclxuICAgICAgc2NvcGU6IHt9LFxyXG4gICAgICB0ZW1wbGF0ZVVybDogZnVuY3Rpb24gKGVsZW1lbnQsIGF0dHJzKSB7XHJcbiAgICAgICAgaWYgKGF0dHJzLnN0VGVtcGxhdGUpIHtcclxuICAgICAgICAgIHJldHVybiBhdHRycy5zdFRlbXBsYXRlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gJ3RlbXBsYXRlL3NtYXJ0LXRhYmxlL3BhZ2luYXRpb25leHRyYS5odG1sJztcclxuICAgICAgfSxcclxuICAgICAgbGluazogZnVuY3Rpb24gKHNjb3BlLCBlbGVtZW50LCBhdHRycywgY3RybCkge1xyXG5cclxuICAgICAgICBzY29wZS5maXJzdEl0ZW0gPSAxO1xyXG5cdHNjb3BlLmxhc3RJdGVtID0gMTtcclxuXHRzY29wZS50b3RhbEl0ZW1zID0gMTtcclxuXHJcbiAgICAgICAgZnVuY3Rpb24gcmVkcmF3KCkge1xyXG4gICAgICAgICAgdmFyIHBhZ2luYXRpb25TdGF0ZSA9IGN0cmwudGFibGVTdGF0ZSgpLnBhZ2luYXRpb247XHJcblx0ICBzY29wZS5maXJzdEl0ZW0gPSBNYXRoLm1pbihwYWdpbmF0aW9uU3RhdGUudG90YWwsIHBhZ2luYXRpb25TdGF0ZS5zdGFydCArIDEpO1xyXG5cdCAgc2NvcGUubGFzdEl0ZW0gPSBNYXRoLm1pbihwYWdpbmF0aW9uU3RhdGUudG90YWwsIHBhZ2luYXRpb25TdGF0ZS5zdGFydCArIHBhZ2luYXRpb25TdGF0ZS5udW1iZXIpO1xyXG5cdCAgc2NvcGUudG90YWxJdGVtcyA9IHBhZ2luYXRpb25TdGF0ZS50b3RhbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vdGFibGUgc3RhdGUgLS0+IHZpZXdcclxuICAgICAgICBzY29wZS4kd2F0Y2goZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgcmV0dXJuIGN0cmwudGFibGVTdGF0ZSgpLnBhZ2luYXRpb247XHJcbiAgICAgICAgfSwgcmVkcmF3LCB0cnVlKTtcclxuXHRcclxuICAgICAgfVxyXG4gICAgfTtcclxuICB9KTtcclxuIiwibmcubW9kdWxlKCdzbWFydC10YWJsZScpXHJcbiAgLmRpcmVjdGl2ZSgnc3RQYWdpbmF0aW9uVG90YWwnLCBmdW5jdGlvbiAoKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICByZXN0cmljdDogJ0VBJyxcclxuICAgICAgcmVxdWlyZTogJ15zdFRhYmxlJyxcclxuICAgICAgc2NvcGU6IHtcclxuICAgICAgICBzdFVwdG9MaW1pdDogJz0/JyxcclxuICAgICAgfSxcclxuICAgICAgdGVtcGxhdGVVcmw6IGZ1bmN0aW9uIChlbGVtZW50LCBhdHRycykge1xyXG4gICAgICAgIGlmIChhdHRycy5zdFRlbXBsYXRlKSB7XHJcbiAgICAgICAgICByZXR1cm4gYXR0cnMuc3RUZW1wbGF0ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuICd0ZW1wbGF0ZS9zbWFydC10YWJsZS9wYWdpbmF0aW9udG90YWwuaHRtbCc7XHJcbiAgICAgIH0sXHJcbiAgICAgIGxpbms6IGZ1bmN0aW9uIChzY29wZSwgZWxlbWVudCwgYXR0cnMsIGN0cmwpIHtcclxuXHJcbiAgICAgICAgc2NvcGUuc3RVcHRvTGltaXQgPSBzY29wZS5zdFVwdG9MaW1pdCA/ICsoc2NvcGUuc3RVcHRvTGltaXQpIDogMTA7XHJcblx0ICAgICAgXHJcblx0c2NvcGUubGltaXRJdGVtcyA9IDE7XHJcblx0c2NvcGUudG90YWxJdGVtcyA9IDE7XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIHJlZHJhdygpIHtcclxuICAgICAgICAgIHZhciBwYWdpbmF0aW9uU3RhdGUgPSBjdHJsLnRhYmxlU3RhdGUoKS5wYWdpbmF0aW9uO1xyXG5cdCAgc2NvcGUubGltaXRJdGVtcyA9IE1hdGgubWluKHBhZ2luYXRpb25TdGF0ZS50b3RhbCwgc2NvcGUuc3RVcHRvTGltaXQpO1xyXG5cdCAgc2NvcGUudG90YWxJdGVtcyA9IHBhZ2luYXRpb25TdGF0ZS50b3RhbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vdGFibGUgc3RhdGUgLS0+IHZpZXdcclxuICAgICAgICBzY29wZS4kd2F0Y2goZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgcmV0dXJuIGN0cmwudGFibGVTdGF0ZSgpLnBhZ2luYXRpb247XHJcbiAgICAgICAgfSwgcmVkcmF3LCB0cnVlKTtcclxuXHJcbiAgICAgICAgLy9zY29wZSAtLT4gdGFibGUgc3RhdGUgICgtLT4gdmlldylcclxuICAgICAgICBzY29wZS4kd2F0Y2goJ3N0VXB0b0xpbWl0JywgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xyXG4gICAgICAgICAgaWYgKG5ld1ZhbHVlICE9PSBvbGRWYWx1ZSkge1xyXG4gICAgICAgICAgICByZWRyYXcoKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHRcclxuICAgICAgfVxyXG4gICAgfTtcclxuICB9KTtcclxuIiwibmcubW9kdWxlKCdzbWFydC10YWJsZScpXHJcbiAgLmRpcmVjdGl2ZSgnc3RQaXBlJywgZnVuY3Rpb24gKCkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgcmVxdWlyZTogJ3N0VGFibGUnLFxyXG4gICAgICBzY29wZToge1xyXG4gICAgICAgIHN0UGlwZTogJz0nXHJcbiAgICAgIH0sXHJcbiAgICAgIGxpbms6IHtcclxuXHJcbiAgICAgICAgcHJlOiBmdW5jdGlvbiAoc2NvcGUsIGVsZW1lbnQsIGF0dHJzLCBjdHJsKSB7XHJcbiAgICAgICAgICBpZiAobmcuaXNGdW5jdGlvbihzY29wZS5zdFBpcGUpKSB7XHJcbiAgICAgICAgICAgIGN0cmwucHJldmVudFBpcGVPbldhdGNoKCk7XHJcbiAgICAgICAgICAgIGN0cmwucGlwZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICByZXR1cm4gc2NvcGUuc3RQaXBlKGN0cmwudGFibGVTdGF0ZSgpLCBjdHJsKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIHBvc3Q6IGZ1bmN0aW9uIChzY29wZSwgZWxlbWVudCwgYXR0cnMsIGN0cmwpIHtcclxuICAgICAgICAgIGN0cmwucGlwZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfTtcclxuICB9KTtcclxuIiwifSkoYW5ndWxhcik7Il0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9