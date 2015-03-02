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
	this.modelVal = function modelVal(whichmodel) {
		if (angular.isDefined(whichmodel) && (whichmodel !== null))
		{
			var findDot = whichmodel.indexOf('.');
			if (findDot !== -1)
			{
				var ctrlr = whichmodel.substr(0,findDot);
				var varbl = whichmodel.substr(findDot+1);
				if (angular.isDefined($scope[ctrlr][varbl]))
				{
					return $scope[ctrlr][varbl];
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
		var initVal = ctrl.modelVal(attr.ngModel);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy90b3AudHh0Iiwic3JjL3NtYXJ0LXRhYmxlLm1vZHVsZS5qcyIsInNyYy9zdFRhYmxlLmpzIiwic3JjL3N0U2VhcmNoLmpzIiwic3JjL3N0U2VsZWN0Um93LmpzIiwic3JjL3N0U29ydC5qcyIsInNyYy9zdFBhZ2luYXRpb24uanMiLCJzcmMvc3RQYWdpbmF0aW9uRXh0cmEuanMiLCJzcmMvc3RQYWdpbmF0aW9uVG90YWwuanMiLCJzcmMvc3RQaXBlLmpzIiwic3JjL2JvdHRvbS50eHQiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNsTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDeERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDaEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMvRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNqQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN4QkEiLCJmaWxlIjoic21hcnQtdGFibGUuanMiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gKG5nLCB1bmRlZmluZWQpe1xyXG4gICAgJ3VzZSBzdHJpY3QnO1xyXG4iLCJuZy5tb2R1bGUoJ3NtYXJ0LXRhYmxlJywgW10pLnJ1bihbJyR0ZW1wbGF0ZUNhY2hlJywgZnVuY3Rpb24gKCR0ZW1wbGF0ZUNhY2hlKSB7XHJcbiAgICAkdGVtcGxhdGVDYWNoZS5wdXQoJ3RlbXBsYXRlL3NtYXJ0LXRhYmxlL3BhZ2luYXRpb24uaHRtbCcsXHJcbiAgICAgICAgJzxuYXYgbmctaWY9XCJwYWdlcy5sZW5ndGggPj0gMlwiPjx1bCBjbGFzcz1cInBhZ2luYXRpb24gcGFnaW5hdGlvbi1zbSBuby10b3AtbWFyZ2luIG5vLWJvdHRvbS1tYXJnaW5cIj4nICtcclxuICAgICAgICAnPGxpIG5nLXJlcGVhdD1cInBhZ2UgaW4gcGFnZXNcIiBuZy1jbGFzcz1cInthY3RpdmU6IHBhZ2U9PWN1cnJlbnRQYWdlfVwiPjxhIG5nLWNsaWNrPVwic2VsZWN0UGFnZShwYWdlKVwiPnt7cGFnZX19PC9hPjwvbGk+JyArXHJcbiAgICAgICAgJzwvdWw+PC9uYXY+Jyk7XHJcbiAgICAkdGVtcGxhdGVDYWNoZS5wdXQoJ3RlbXBsYXRlL3NtYXJ0LXRhYmxlL3BhZ2luYXRpb25leHRyYS5odG1sJyxcclxuICAgICAgICAne3tmaXJzdEl0ZW19fSB0byB7e2xhc3RJdGVtfX0gb2Yge3t0b3RhbEl0ZW1zfX0nKTtcdFxyXG4gICAgJHRlbXBsYXRlQ2FjaGUucHV0KCd0ZW1wbGF0ZS9zbWFydC10YWJsZS9wYWdpbmF0aW9udG90YWwuaHRtbCcsXHJcbiAgICAgICAgJ3t7bGltaXRJdGVtc319IG9mIHt7dG90YWxJdGVtc319Jyk7XHRcclxufV0pO1xyXG5cclxuIiwibmcubW9kdWxlKCdzbWFydC10YWJsZScpXHJcbiAgLmNvbnRyb2xsZXIoJ3N0VGFibGVDb250cm9sbGVyJywgWyckc2NvcGUnLCAnJHBhcnNlJywgJyRmaWx0ZXInLCAnJGF0dHJzJywgZnVuY3Rpb24gU3RUYWJsZUNvbnRyb2xsZXIoJHNjb3BlLCAkcGFyc2UsICRmaWx0ZXIsICRhdHRycykge1xyXG4gICAgdmFyIHByb3BlcnR5TmFtZSA9ICRhdHRycy5zdFRhYmxlO1xyXG4gICAgdmFyIGRpc3BsYXlHZXR0ZXIgPSAkcGFyc2UocHJvcGVydHlOYW1lKTtcclxuICAgIHZhciBkaXNwbGF5U2V0dGVyID0gZGlzcGxheUdldHRlci5hc3NpZ247XHJcbiAgICB2YXIgc2FmZUdldHRlcjtcclxuICAgIHZhciBvcmRlckJ5ID0gJGZpbHRlcignb3JkZXJCeScpO1xyXG4gICAgdmFyIGZpbHRlciA9ICRmaWx0ZXIoJ2ZpbHRlcicpO1xyXG4gICAgdmFyIHNhZmVDb3B5ID0gY29weVJlZnMoZGlzcGxheUdldHRlcigkc2NvcGUpKTtcclxuICAgIHZhciB0YWJsZVN0YXRlID0ge1xyXG4gICAgICBzb3J0OiB7fSxcclxuICAgICAgc2VhcmNoOiB7fSxcclxuICAgICAgcGFnaW5hdGlvbjoge1xyXG4gICAgICAgIHN0YXJ0OiAwXHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgICB2YXIgcGlwZUFmdGVyU2FmZUNvcHkgPSB0cnVlO1xyXG4gICAgdmFyIGN0cmwgPSB0aGlzO1xyXG4gICAgdmFyIGxhc3RTZWxlY3RlZDtcclxuXHJcbiAgICBmdW5jdGlvbiBjb3B5UmVmcyhzcmMpIHtcclxuICAgICAgcmV0dXJuIHNyYyA/IFtdLmNvbmNhdChzcmMpIDogW107XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gdXBkYXRlU2FmZUNvcHkoKSB7XHJcbiAgICAgIHNhZmVDb3B5ID0gY29weVJlZnMoc2FmZUdldHRlcigkc2NvcGUpKTtcclxuICAgICAgaWYgKHBpcGVBZnRlclNhZmVDb3B5ID09PSB0cnVlKSB7XHJcbiAgICAgICAgY3RybC5waXBlKCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAoJGF0dHJzLnN0U2FmZVNyYykge1xyXG4gICAgICBzYWZlR2V0dGVyID0gJHBhcnNlKCRhdHRycy5zdFNhZmVTcmMpO1xyXG4gICAgICAkc2NvcGUuJHdhdGNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgc2FmZVNyYyA9IHNhZmVHZXR0ZXIoJHNjb3BlKTtcclxuICAgICAgICByZXR1cm4gc2FmZVNyYyA/IHNhZmVTcmMubGVuZ3RoIDogMDtcclxuXHJcbiAgICAgIH0sIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcclxuICAgICAgICBpZiAobmV3VmFsdWUgIT09IHNhZmVDb3B5Lmxlbmd0aCkge1xyXG4gICAgICAgICAgdXBkYXRlU2FmZUNvcHkoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgICAkc2NvcGUuJHdhdGNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gc2FmZUdldHRlcigkc2NvcGUpO1xyXG4gICAgICB9LCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XHJcbiAgICAgICAgaWYgKG5ld1ZhbHVlICE9PSBvbGRWYWx1ZSkge1xyXG4gICAgICAgICAgdXBkYXRlU2FmZUNvcHkoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuXHQvL01DIHRoaXMgaXMgaG9ycmlibGUgYnV0IGEgd2F5IG9mIGdldHRpbmcgYWNjZXNzIHRvIHRoZSB2YWx1ZSB0byBzZWUgaWYgaXQncyBiZWVuIGluaXRpYWxpemVkIGluIHRoZSBkaXJlY3RpdmVcclxuXHR0aGlzLm1vZGVsVmFsID0gZnVuY3Rpb24gbW9kZWxWYWwod2hpY2htb2RlbCkge1xyXG5cdFx0aWYgKGFuZ3VsYXIuaXNEZWZpbmVkKHdoaWNobW9kZWwpICYmICh3aGljaG1vZGVsICE9PSBudWxsKSlcclxuXHRcdHtcclxuXHRcdFx0dmFyIGZpbmREb3QgPSB3aGljaG1vZGVsLmluZGV4T2YoJy4nKTtcclxuXHRcdFx0aWYgKGZpbmREb3QgIT09IC0xKVxyXG5cdFx0XHR7XHJcblx0XHRcdFx0dmFyIGN0cmxyID0gd2hpY2htb2RlbC5zdWJzdHIoMCxmaW5kRG90KTtcclxuXHRcdFx0XHR2YXIgdmFyYmwgPSB3aGljaG1vZGVsLnN1YnN0cihmaW5kRG90KzEpO1xyXG5cdFx0XHRcdGlmIChhbmd1bGFyLmlzRGVmaW5lZCgkc2NvcGVbY3RybHJdW3ZhcmJsXSkpXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0cmV0dXJuICRzY29wZVtjdHJscl1bdmFyYmxdO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIG51bGw7XHJcblx0fTsgICAgXHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogc29ydCB0aGUgcm93c1xyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbiB8IFN0cmluZ30gcHJlZGljYXRlIC0gZnVuY3Rpb24gb3Igc3RyaW5nIHdoaWNoIHdpbGwgYmUgdXNlZCBhcyBwcmVkaWNhdGUgZm9yIHRoZSBzb3J0aW5nXHJcbiAgICAgKiBAcGFyYW0gW3JldmVyc2VdIC0gaWYgeW91IHdhbnQgdG8gcmV2ZXJzZSB0aGUgb3JkZXJcclxuICAgICAqL1xyXG4gICAgdGhpcy5zb3J0QnkgPSBmdW5jdGlvbiBzb3J0QnkocHJlZGljYXRlLCByZXZlcnNlKSB7XHJcbiAgICAgIHRhYmxlU3RhdGUuc29ydC5wcmVkaWNhdGUgPSBwcmVkaWNhdGU7XHJcbiAgICAgIHRhYmxlU3RhdGUuc29ydC5yZXZlcnNlID0gcmV2ZXJzZSA9PT0gdHJ1ZTtcclxuXHJcbiAgICAgIGlmIChuZy5pc0Z1bmN0aW9uKHByZWRpY2F0ZSkpIHtcclxuICAgICAgICB0YWJsZVN0YXRlLnNvcnQuZnVuY3Rpb25OYW1lID0gcHJlZGljYXRlLm5hbWU7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgZGVsZXRlIHRhYmxlU3RhdGUuc29ydC5mdW5jdGlvbk5hbWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHRhYmxlU3RhdGUucGFnaW5hdGlvbi5zdGFydCA9IDA7XHJcbiAgICAgIHJldHVybiB0aGlzLnBpcGUoKTtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBzZWFyY2ggbWF0Y2hpbmcgcm93c1xyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGlucHV0IC0gdGhlIGlucHV0IHN0cmluZ1xyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IFtwcmVkaWNhdGVdIC0gdGhlIHByb3BlcnR5IG5hbWUgYWdhaW5zdCB5b3Ugd2FudCB0byBjaGVjayB0aGUgbWF0Y2gsIG90aGVyd2lzZSBpdCB3aWxsIHNlYXJjaCBvbiBhbGwgcHJvcGVydGllc1xyXG4gICAgICovXHJcbiAgICB0aGlzLnNlYXJjaCA9IGZ1bmN0aW9uIHNlYXJjaChpbnB1dCwgcHJlZGljYXRlKSB7XHJcbiAgICAgIHZhciBwcmVkaWNhdGVPYmplY3QgPSB0YWJsZVN0YXRlLnNlYXJjaC5wcmVkaWNhdGVPYmplY3QgfHwge307XHJcbiAgICAgIHZhciBwcm9wID0gcHJlZGljYXRlID8gcHJlZGljYXRlIDogJyQnO1xyXG5cclxuICAgICAgaW5wdXQgPSBuZy5pc1N0cmluZyhpbnB1dCkgPyBpbnB1dC50cmltKCkgOiBpbnB1dDtcclxuICAgICAgcHJlZGljYXRlT2JqZWN0W3Byb3BdID0gaW5wdXQ7XHJcbiAgICAgIC8vIHRvIGF2b2lkIHRvIGZpbHRlciBvdXQgbnVsbCB2YWx1ZVxyXG4gICAgICBpZiAoIWlucHV0KSB7XHJcbiAgICAgICAgZGVsZXRlIHByZWRpY2F0ZU9iamVjdFtwcm9wXTtcclxuICAgICAgfVxyXG4gICAgICB0YWJsZVN0YXRlLnNlYXJjaC5wcmVkaWNhdGVPYmplY3QgPSBwcmVkaWNhdGVPYmplY3Q7XHJcbiAgICAgIHRhYmxlU3RhdGUucGFnaW5hdGlvbi5zdGFydCA9IDA7XHJcbiAgICAgIHJldHVybiB0aGlzLnBpcGUoKTtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiB0aGlzIHdpbGwgY2hhaW4gdGhlIG9wZXJhdGlvbnMgb2Ygc29ydGluZyBhbmQgZmlsdGVyaW5nIGJhc2VkIG9uIHRoZSBjdXJyZW50IHRhYmxlIHN0YXRlIChzb3J0IG9wdGlvbnMsIGZpbHRlcmluZywgZWN0KVxyXG4gICAgICovXHJcbiAgICB0aGlzLnBpcGUgPSBmdW5jdGlvbiBwaXBlKCkge1xyXG4gICAgICB2YXIgcGFnaW5hdGlvbiA9IHRhYmxlU3RhdGUucGFnaW5hdGlvbjtcclxuICAgICAgdmFyIGZpbHRlcmVkID0gdGFibGVTdGF0ZS5zZWFyY2gucHJlZGljYXRlT2JqZWN0ID8gZmlsdGVyKHNhZmVDb3B5LCB0YWJsZVN0YXRlLnNlYXJjaC5wcmVkaWNhdGVPYmplY3QpIDogc2FmZUNvcHk7XHJcbiAgICAgIGlmICh0YWJsZVN0YXRlLnNvcnQucHJlZGljYXRlKSB7XHJcbiAgICAgICAgZmlsdGVyZWQgPSBvcmRlckJ5KGZpbHRlcmVkLCB0YWJsZVN0YXRlLnNvcnQucHJlZGljYXRlLCB0YWJsZVN0YXRlLnNvcnQucmV2ZXJzZSk7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIC8vTUMgcmVjb3JkIHRvdGFsIG9mIGZpbHRlcmVkIGl0ZW1zXHJcbiAgICAgIHBhZ2luYXRpb24udG90YWwgPSBmaWx0ZXJlZC5sZW5ndGg7XHJcbiAgICAgIFxyXG4gICAgICBpZiAocGFnaW5hdGlvbi5udW1iZXIgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIHBhZ2luYXRpb24ubnVtYmVyT2ZQYWdlcyA9IGZpbHRlcmVkLmxlbmd0aCA+IDAgPyBNYXRoLmNlaWwoZmlsdGVyZWQubGVuZ3RoIC8gcGFnaW5hdGlvbi5udW1iZXIpIDogMTtcclxuICAgICAgICBwYWdpbmF0aW9uLnN0YXJ0ID0gcGFnaW5hdGlvbi5zdGFydCA+PSBmaWx0ZXJlZC5sZW5ndGggPyAocGFnaW5hdGlvbi5udW1iZXJPZlBhZ2VzIC0gMSkgKiBwYWdpbmF0aW9uLm51bWJlciA6IHBhZ2luYXRpb24uc3RhcnQ7XHJcbiAgICAgICAgZmlsdGVyZWQgPSBmaWx0ZXJlZC5zbGljZShwYWdpbmF0aW9uLnN0YXJ0LCBwYWdpbmF0aW9uLnN0YXJ0ICsgcGFyc2VJbnQocGFnaW5hdGlvbi5udW1iZXIpKTtcclxuICAgICAgfVxyXG4gICAgICBkaXNwbGF5U2V0dGVyKCRzY29wZSwgZmlsdGVyZWQpO1xyXG4gICAgfTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIHNlbGVjdCBhIGRhdGFSb3cgKGl0IHdpbGwgYWRkIHRoZSBhdHRyaWJ1dGUgaXNTZWxlY3RlZCB0byB0aGUgcm93IG9iamVjdClcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByb3cgLSB0aGUgcm93IHRvIHNlbGVjdFxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IFttb2RlXSAtIFwic2luZ2xlXCIgb3IgXCJtdWx0aXBsZVwiIChtdWx0aXBsZSBieSBkZWZhdWx0KVxyXG4gICAgICovXHJcbiAgICB0aGlzLnNlbGVjdCA9IGZ1bmN0aW9uIHNlbGVjdChyb3csIG1vZGUpIHtcclxuICAgICAgdmFyIHJvd3MgPSBzYWZlQ29weTtcclxuICAgICAgdmFyIGluZGV4ID0gcm93cy5pbmRleE9mKHJvdyk7XHJcbiAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcclxuICAgICAgICBpZiAobW9kZSA9PT0gJ3NpbmdsZScpIHtcclxuICAgICAgICAgIHJvdy5pc1NlbGVjdGVkID0gcm93LmlzU2VsZWN0ZWQgIT09IHRydWU7XHJcbiAgICAgICAgICBpZiAobGFzdFNlbGVjdGVkKSB7XHJcbiAgICAgICAgICAgIGxhc3RTZWxlY3RlZC5pc1NlbGVjdGVkID0gZmFsc2U7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBsYXN0U2VsZWN0ZWQgPSByb3cuaXNTZWxlY3RlZCA9PT0gdHJ1ZSA/IHJvdyA6IHVuZGVmaW5lZDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgcm93c1tpbmRleF0uaXNTZWxlY3RlZCA9ICFyb3dzW2luZGV4XS5pc1NlbGVjdGVkO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIHRha2UgYSBzbGljZSBvZiB0aGUgY3VycmVudCBzb3J0ZWQvZmlsdGVyZWQgY29sbGVjdGlvbiAocGFnaW5hdGlvbilcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gc3RhcnQgLSBzdGFydCBpbmRleCBvZiB0aGUgc2xpY2VcclxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBudW1iZXIgLSB0aGUgbnVtYmVyIG9mIGl0ZW0gaW4gdGhlIHNsaWNlXHJcbiAgICAgKi9cclxuICAgIHRoaXMuc2xpY2UgPSBmdW5jdGlvbiBzcGxpY2Uoc3RhcnQsIG51bWJlcikge1xyXG4gICAgICB0YWJsZVN0YXRlLnBhZ2luYXRpb24uc3RhcnQgPSBzdGFydDtcclxuICAgICAgdGFibGVTdGF0ZS5wYWdpbmF0aW9uLm51bWJlciA9IG51bWJlcjtcclxuICAgICAgcmV0dXJuIHRoaXMucGlwZSgpO1xyXG4gICAgfTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIHJldHVybiB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgdGFibGVcclxuICAgICAqIEByZXR1cm5zIHt7c29ydDoge30sIHNlYXJjaDoge30sIHBhZ2luYXRpb246IHtzdGFydDogbnVtYmVyfX19XHJcbiAgICAgKi9cclxuICAgIHRoaXMudGFibGVTdGF0ZSA9IGZ1bmN0aW9uIGdldFRhYmxlU3RhdGUoKSB7XHJcbiAgICAgIHJldHVybiB0YWJsZVN0YXRlO1xyXG4gICAgfTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFVzZSBhIGRpZmZlcmVudCBmaWx0ZXIgZnVuY3Rpb24gdGhhbiB0aGUgYW5ndWxhciBGaWx0ZXJGaWx0ZXJcclxuICAgICAqIEBwYXJhbSBmaWx0ZXJOYW1lIHRoZSBuYW1lIHVuZGVyIHdoaWNoIHRoZSBjdXN0b20gZmlsdGVyIGlzIHJlZ2lzdGVyZWRcclxuICAgICAqL1xyXG4gICAgdGhpcy5zZXRGaWx0ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uIHNldEZpbHRlckZ1bmN0aW9uKGZpbHRlck5hbWUpIHtcclxuICAgICAgZmlsdGVyID0gJGZpbHRlcihmaWx0ZXJOYW1lKTtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKlVzZXIgYSBkaWZmZXJlbnQgZnVuY3Rpb24gdGhhbiB0aGUgYW5ndWxhciBvcmRlckJ5XHJcbiAgICAgKiBAcGFyYW0gc29ydEZ1bmN0aW9uTmFtZSB0aGUgbmFtZSB1bmRlciB3aGljaCB0aGUgY3VzdG9tIG9yZGVyIGZ1bmN0aW9uIGlzIHJlZ2lzdGVyZWRcclxuICAgICAqL1xyXG4gICAgdGhpcy5zZXRTb3J0RnVuY3Rpb24gPSBmdW5jdGlvbiBzZXRTb3J0RnVuY3Rpb24oc29ydEZ1bmN0aW9uTmFtZSkge1xyXG4gICAgICBvcmRlckJ5ID0gJGZpbHRlcihzb3J0RnVuY3Rpb25OYW1lKTtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBVc3VhbGx5IHdoZW4gdGhlIHNhZmUgY29weSBpcyB1cGRhdGVkIHRoZSBwaXBlIGZ1bmN0aW9uIGlzIGNhbGxlZC5cclxuICAgICAqIENhbGxpbmcgdGhpcyBtZXRob2Qgd2lsbCBwcmV2ZW50IGl0LCB3aGljaCBpcyBzb21ldGhpbmcgcmVxdWlyZWQgd2hlbiB1c2luZyBhIGN1c3RvbSBwaXBlIGZ1bmN0aW9uXHJcbiAgICAgKi9cclxuICAgIHRoaXMucHJldmVudFBpcGVPbldhdGNoID0gZnVuY3Rpb24gcHJldmVudFBpcGUoKSB7XHJcbiAgICAgIHBpcGVBZnRlclNhZmVDb3B5ID0gZmFsc2U7XHJcbiAgICB9O1xyXG4gIH1dKVxyXG4gIC5kaXJlY3RpdmUoJ3N0VGFibGUnLCBmdW5jdGlvbiAoKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICByZXN0cmljdDogJ0EnLFxyXG4gICAgICBjb250cm9sbGVyOiAnc3RUYWJsZUNvbnRyb2xsZXInLFxyXG4gICAgICBsaW5rOiBmdW5jdGlvbiAoc2NvcGUsIGVsZW1lbnQsIGF0dHIsIGN0cmwpIHtcclxuXHJcbiAgICAgICAgaWYgKGF0dHIuc3RTZXRGaWx0ZXIpIHtcclxuICAgICAgICAgIGN0cmwuc2V0RmlsdGVyRnVuY3Rpb24oYXR0ci5zdFNldEZpbHRlcik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoYXR0ci5zdFNldFNvcnQpIHtcclxuICAgICAgICAgIGN0cmwuc2V0U29ydEZ1bmN0aW9uKGF0dHIuc3RTZXRTb3J0KTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgfSk7XHJcbiIsIm5nLm1vZHVsZSgnc21hcnQtdGFibGUnKVxyXG4gICAgLmRpcmVjdGl2ZSgnc3RTZWFyY2gnLCBbJyR0aW1lb3V0JywgZnVuY3Rpb24gKCR0aW1lb3V0KSB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgcmVxdWlyZTogJ15zdFRhYmxlJyxcclxuICAgICAgICAgICAgc2NvcGU6IHtcclxuICAgICAgICAgICAgICAgIHByZWRpY2F0ZTogJz0/c3RTZWFyY2gnXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGxpbms6IGZ1bmN0aW9uIChzY29wZSwgZWxlbWVudCwgYXR0ciwgY3RybCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIHRhYmxlQ3RybCA9IGN0cmw7XHJcbiAgICAgICAgICAgICAgICB2YXIgcHJvbWlzZSA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICB2YXIgdGhyb3R0bGUgPSBhdHRyLnN0RGVsYXkgfHwgNDAwO1xyXG5cclxuXHRcdC8vTUMgaW5pdGlhbGl6ZSB0aGUgc2VhcmNoIGlmIHZhbHVlcyBzZXQgZm9yIG91ciBtb2RlbFxyXG5cdFx0dmFyIGluaXRWYWwgPSBjdHJsLm1vZGVsVmFsKGF0dHIubmdNb2RlbCk7XHJcblx0XHRpZiAoaW5pdFZhbCAhPT0gbnVsbClcclxuXHRcdHtcclxuXHRcdFx0dGFibGVDdHJsLnNlYXJjaChpbml0VmFsLCBzY29wZS5wcmVkaWNhdGUgfHwgJycpO1xyXG5cdFx0fVxyXG5cdFx0ICAgIFxyXG4gICAgICAgICAgICAgICAgc2NvcGUuJHdhdGNoKCdwcmVkaWNhdGUnLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5ld1ZhbHVlICE9PSBvbGRWYWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjdHJsLnRhYmxlU3RhdGUoKS5zZWFyY2ggPSB7fTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGFibGVDdHJsLnNlYXJjaChlbGVtZW50WzBdLnZhbHVlIHx8ICcnLCBuZXdWYWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy90YWJsZSBzdGF0ZSAtPiB2aWV3XHJcbiAgICAgICAgICAgICAgICBzY29wZS4kd2F0Y2goZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjdHJsLnRhYmxlU3RhdGUoKS5zZWFyY2g7XHJcbiAgICAgICAgICAgICAgICB9LCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHByZWRpY2F0ZUV4cHJlc3Npb24gPSBzY29wZS5wcmVkaWNhdGUgfHwgJyQnO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChuZXdWYWx1ZS5wcmVkaWNhdGVPYmplY3QgJiYgbmV3VmFsdWUucHJlZGljYXRlT2JqZWN0W3ByZWRpY2F0ZUV4cHJlc3Npb25dICE9PSBlbGVtZW50WzBdLnZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRbMF0udmFsdWUgPSBuZXdWYWx1ZS5wcmVkaWNhdGVPYmplY3RbcHJlZGljYXRlRXhwcmVzc2lvbl0gfHwgJyc7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSwgdHJ1ZSk7XHJcblxyXG5cdFx0ZnVuY3Rpb24gc2VhcmNoRmlsdGVyKGV2dCkge1xyXG5cdFx0ICAgIGV2dCA9IGV2dC5vcmlnaW5hbEV2ZW50IHx8IGV2dDtcclxuICAgICAgICAgICAgICAgICAgICBpZiAocHJvbWlzZSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAkdGltZW91dC5jYW5jZWwocHJvbWlzZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHByb21pc2UgPSAkdGltZW91dChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhYmxlQ3RybC5zZWFyY2goZXZ0LnRhcmdldC52YWx1ZSwgc2NvcGUucHJlZGljYXRlIHx8ICcnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvbWlzZSA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgfSwgdGhyb3R0bGUpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cdFx0XHJcbiAgICAgICAgICAgICAgICAvLyB2aWV3IC0+IHRhYmxlIHN0YXRlXHJcblx0XHRpZiAoZWxlbWVudC5wcm9wKCd0YWdOYW1lJykgPT0gJ1NFTEVDVCcpIHtcclxuXHRcdFx0ZWxlbWVudC5iaW5kKCdjaGFuZ2UnLCBzZWFyY2hGaWx0ZXIpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0ZWxlbWVudC5iaW5kKCdpbnB1dCcsIHNlYXJjaEZpbHRlcik7XHJcblx0XHR9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG4gICAgfV0pO1xyXG4iLCJuZy5tb2R1bGUoJ3NtYXJ0LXRhYmxlJylcclxuICAuZGlyZWN0aXZlKCdzdFNlbGVjdFJvdycsIGZ1bmN0aW9uICgpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHJlc3RyaWN0OiAnQScsXHJcbiAgICAgIHJlcXVpcmU6ICdec3RUYWJsZScsXHJcbiAgICAgIHNjb3BlOiB7XHJcbiAgICAgICAgcm93OiAnPXN0U2VsZWN0Um93J1xyXG4gICAgICB9LFxyXG4gICAgICBsaW5rOiBmdW5jdGlvbiAoc2NvcGUsIGVsZW1lbnQsIGF0dHIsIGN0cmwpIHtcclxuICAgICAgICB2YXIgbW9kZSA9IGF0dHIuc3RTZWxlY3RNb2RlIHx8ICdzaW5nbGUnO1xyXG4gICAgICAgIGVsZW1lbnQuYmluZCgnY2xpY2snLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICBzY29wZS4kYXBwbHkoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBjdHJsLnNlbGVjdChzY29wZS5yb3csIG1vZGUpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHNjb3BlLiR3YXRjaCgncm93LmlzU2VsZWN0ZWQnLCBmdW5jdGlvbiAobmV3VmFsdWUpIHtcclxuICAgICAgICAgIGlmIChuZXdWYWx1ZSA9PT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICBlbGVtZW50LmFkZENsYXNzKCdzdC1zZWxlY3RlZCcpO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgZWxlbWVudC5yZW1vdmVDbGFzcygnc3Qtc2VsZWN0ZWQnKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfTtcclxuICB9KTtcclxuIiwibmcubW9kdWxlKCdzbWFydC10YWJsZScpXHJcbiAgLmRpcmVjdGl2ZSgnc3RTb3J0JywgWyckcGFyc2UnLCBmdW5jdGlvbiAoJHBhcnNlKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICByZXN0cmljdDogJ0EnLFxyXG4gICAgICByZXF1aXJlOiAnXnN0VGFibGUnLFxyXG4gICAgICBsaW5rOiBmdW5jdGlvbiAoc2NvcGUsIGVsZW1lbnQsIGF0dHIsIGN0cmwpIHtcclxuXHJcbiAgICAgICAgdmFyIHByZWRpY2F0ZSA9IGF0dHIuc3RTb3J0O1xyXG4gICAgICAgIHZhciBnZXR0ZXIgPSAkcGFyc2UocHJlZGljYXRlKTtcclxuICAgICAgICB2YXIgaW5kZXggPSAwO1xyXG4gICAgICAgIHZhciBjbGFzc0FzY2VudCA9IGF0dHIuc3RDbGFzc0FzY2VudCB8fCAnc3Qtc29ydC1hc2NlbnQnO1xyXG4gICAgICAgIHZhciBjbGFzc0Rlc2NlbnQgPSBhdHRyLnN0Q2xhc3NEZXNjZW50IHx8ICdzdC1zb3J0LWRlc2NlbnQnO1xyXG4gICAgICAgIHZhciBzdGF0ZUNsYXNzZXMgPSBbY2xhc3NBc2NlbnQsIGNsYXNzRGVzY2VudF07XHJcbiAgICAgICAgdmFyIHNvcnREZWZhdWx0O1xyXG5cclxuICAgICAgICBpZiAoYXR0ci5zdFNvcnREZWZhdWx0KSB7XHJcbiAgICAgICAgICBzb3J0RGVmYXVsdCA9IHNjb3BlLiRldmFsKGF0dHIuc3RTb3J0RGVmYXVsdCkgIT09IHVuZGVmaW5lZCA/ICBzY29wZS4kZXZhbChhdHRyLnN0U29ydERlZmF1bHQpIDogYXR0ci5zdFNvcnREZWZhdWx0O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy92aWV3IC0tPiB0YWJsZSBzdGF0ZVxyXG4gICAgICAgIGZ1bmN0aW9uIHNvcnQoKSB7XHJcbiAgICAgICAgICBpbmRleCsrO1xyXG4gICAgICAgICAgcHJlZGljYXRlID0gbmcuaXNGdW5jdGlvbihnZXR0ZXIoc2NvcGUpKSA/IGdldHRlcihzY29wZSkgOiBhdHRyLnN0U29ydDtcclxuICAgICAgICAgIGlmIChpbmRleCAlIDMgPT09IDAgJiYgYXR0ci5zdFNraXBOYXR1cmFsID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgLy9tYW51YWwgcmVzZXRcclxuICAgICAgICAgICAgaW5kZXggPSAwO1xyXG4gICAgICAgICAgICBjdHJsLnRhYmxlU3RhdGUoKS5zb3J0ID0ge307XHJcbiAgICAgICAgICAgIGN0cmwudGFibGVTdGF0ZSgpLnBhZ2luYXRpb24uc3RhcnQgPSAwO1xyXG4gICAgICAgICAgICBjdHJsLnBpcGUoKTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGN0cmwuc29ydEJ5KHByZWRpY2F0ZSwgaW5kZXggJSAyID09PSAwKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGVsZW1lbnQuYmluZCgnY2xpY2snLCBmdW5jdGlvbiBzb3J0Q2xpY2soKSB7XHJcbiAgICAgICAgICBpZiAocHJlZGljYXRlKSB7XHJcbiAgICAgICAgICAgIHNjb3BlLiRhcHBseShzb3J0KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaWYgKHNvcnREZWZhdWx0KSB7XHJcbiAgICAgICAgICBpbmRleCA9IGF0dHIuc3RTb3J0RGVmYXVsdCA9PT0gJ3JldmVyc2UnID8gMSA6IDA7XHJcbiAgICAgICAgICBzb3J0KCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL3RhYmxlIHN0YXRlIC0tPiB2aWV3XHJcbiAgICAgICAgc2NvcGUuJHdhdGNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgIHJldHVybiBjdHJsLnRhYmxlU3RhdGUoKS5zb3J0O1xyXG4gICAgICAgIH0sIGZ1bmN0aW9uIChuZXdWYWx1ZSkge1xyXG4gICAgICAgICAgaWYgKG5ld1ZhbHVlLnByZWRpY2F0ZSAhPT0gcHJlZGljYXRlKSB7XHJcbiAgICAgICAgICAgIGluZGV4ID0gMDtcclxuICAgICAgICAgICAgZWxlbWVudFxyXG4gICAgICAgICAgICAgIC5yZW1vdmVDbGFzcyhjbGFzc0FzY2VudClcclxuICAgICAgICAgICAgICAucmVtb3ZlQ2xhc3MoY2xhc3NEZXNjZW50KTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGluZGV4ID0gbmV3VmFsdWUucmV2ZXJzZSA9PT0gdHJ1ZSA/IDIgOiAxO1xyXG4gICAgICAgICAgICBlbGVtZW50XHJcbiAgICAgICAgICAgICAgLnJlbW92ZUNsYXNzKHN0YXRlQ2xhc3Nlc1tpbmRleCAlIDJdKVxyXG4gICAgICAgICAgICAgIC5hZGRDbGFzcyhzdGF0ZUNsYXNzZXNbaW5kZXggLSAxXSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSwgdHJ1ZSk7XHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgfV0pO1xyXG4iLCJuZy5tb2R1bGUoJ3NtYXJ0LXRhYmxlJylcclxuICAuZGlyZWN0aXZlKCdzdFBhZ2luYXRpb24nLCBmdW5jdGlvbiAoKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICByZXN0cmljdDogJ0VBJyxcclxuICAgICAgcmVxdWlyZTogJ15zdFRhYmxlJyxcclxuICAgICAgc2NvcGU6IHtcclxuICAgICAgICBzdEl0ZW1zQnlQYWdlOiAnPT8nLFxyXG4gICAgICAgIHN0RGlzcGxheWVkUGFnZXM6ICc9PycsXHJcbiAgICAgICAgc3RQYWdlQ2hhbmdlOiAnJidcclxuICAgICAgfSxcclxuICAgICAgdGVtcGxhdGVVcmw6IGZ1bmN0aW9uIChlbGVtZW50LCBhdHRycykge1xyXG4gICAgICAgIGlmIChhdHRycy5zdFRlbXBsYXRlKSB7XHJcbiAgICAgICAgICByZXR1cm4gYXR0cnMuc3RUZW1wbGF0ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuICd0ZW1wbGF0ZS9zbWFydC10YWJsZS9wYWdpbmF0aW9uLmh0bWwnO1xyXG4gICAgICB9LFxyXG4gICAgICBsaW5rOiBmdW5jdGlvbiAoc2NvcGUsIGVsZW1lbnQsIGF0dHJzLCBjdHJsKSB7XHJcblxyXG4gICAgICAgIHNjb3BlLnN0SXRlbXNCeVBhZ2UgPSBzY29wZS5zdEl0ZW1zQnlQYWdlID8gKyhzY29wZS5zdEl0ZW1zQnlQYWdlKSA6IDEwO1xyXG4gICAgICAgIHNjb3BlLnN0RGlzcGxheWVkUGFnZXMgPSBzY29wZS5zdERpc3BsYXllZFBhZ2VzID8gKyhzY29wZS5zdERpc3BsYXllZFBhZ2VzKSA6IDU7XHJcblxyXG4gICAgICAgIHNjb3BlLmN1cnJlbnRQYWdlID0gMTtcclxuICAgICAgICBzY29wZS5wYWdlcyA9IFtdO1xyXG5cclxuICAgICAgICBmdW5jdGlvbiByZWRyYXcoKSB7XHJcbiAgICAgICAgICB2YXIgcGFnaW5hdGlvblN0YXRlID0gY3RybC50YWJsZVN0YXRlKCkucGFnaW5hdGlvbjtcclxuICAgICAgICAgIHZhciBzdGFydCA9IDE7XHJcbiAgICAgICAgICB2YXIgZW5kO1xyXG4gICAgICAgICAgdmFyIGk7XHJcbiAgICAgICAgICB2YXIgcHJldlBhZ2UgPSBzY29wZS5jdXJyZW50UGFnZTtcclxuICAgICAgICAgIHNjb3BlLmN1cnJlbnRQYWdlID0gTWF0aC5mbG9vcihwYWdpbmF0aW9uU3RhdGUuc3RhcnQgLyBwYWdpbmF0aW9uU3RhdGUubnVtYmVyKSArIDE7XHJcblxyXG4gICAgICAgICAgc3RhcnQgPSBNYXRoLm1heChzdGFydCwgc2NvcGUuY3VycmVudFBhZ2UgLSBNYXRoLmFicyhNYXRoLmZsb29yKHNjb3BlLnN0RGlzcGxheWVkUGFnZXMgLyAyKSkpO1xyXG4gICAgICAgICAgZW5kID0gc3RhcnQgKyBzY29wZS5zdERpc3BsYXllZFBhZ2VzO1xyXG5cclxuICAgICAgICAgIGlmIChlbmQgPiBwYWdpbmF0aW9uU3RhdGUubnVtYmVyT2ZQYWdlcykge1xyXG4gICAgICAgICAgICBlbmQgPSBwYWdpbmF0aW9uU3RhdGUubnVtYmVyT2ZQYWdlcyArIDE7XHJcbiAgICAgICAgICAgIHN0YXJ0ID0gTWF0aC5tYXgoMSwgZW5kIC0gc2NvcGUuc3REaXNwbGF5ZWRQYWdlcyk7XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgc2NvcGUucGFnZXMgPSBbXTtcclxuICAgICAgICAgIHNjb3BlLm51bVBhZ2VzID0gcGFnaW5hdGlvblN0YXRlLm51bWJlck9mUGFnZXM7XHJcblxyXG4gICAgICAgICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xyXG4gICAgICAgICAgICBzY29wZS5wYWdlcy5wdXNoKGkpO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIGlmIChwcmV2UGFnZSE9PXNjb3BlLmN1cnJlbnRQYWdlKSB7XHJcbiAgICAgICAgICAgIHNjb3BlLnN0UGFnZUNoYW5nZSh7bmV3UGFnZTogc2NvcGUuY3VycmVudFBhZ2V9KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vdGFibGUgc3RhdGUgLS0+IHZpZXdcclxuICAgICAgICBzY29wZS4kd2F0Y2goZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgcmV0dXJuIGN0cmwudGFibGVTdGF0ZSgpLnBhZ2luYXRpb247XHJcbiAgICAgICAgfSwgcmVkcmF3LCB0cnVlKTtcclxuXHJcbiAgICAgICAgLy9zY29wZSAtLT4gdGFibGUgc3RhdGUgICgtLT4gdmlldylcclxuICAgICAgICBzY29wZS4kd2F0Y2goJ3N0SXRlbXNCeVBhZ2UnLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XHJcbiAgICAgICAgICBpZiAobmV3VmFsdWUgIT09IG9sZFZhbHVlKSB7XHJcbiAgICAgICAgICAgIHNjb3BlLnNlbGVjdFBhZ2UoMSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHNjb3BlLiR3YXRjaCgnc3REaXNwbGF5ZWRQYWdlcycsIHJlZHJhdyk7XHJcblxyXG4gICAgICAgIC8vdmlldyAtPiB0YWJsZSBzdGF0ZVxyXG4gICAgICAgIHNjb3BlLnNlbGVjdFBhZ2UgPSBmdW5jdGlvbiAocGFnZSkge1xyXG4gICAgICAgICAgaWYgKHBhZ2UgPiAwICYmIHBhZ2UgPD0gc2NvcGUubnVtUGFnZXMpIHtcclxuICAgICAgICAgICAgY3RybC5zbGljZSgocGFnZSAtIDEpICogc2NvcGUuc3RJdGVtc0J5UGFnZSwgc2NvcGUuc3RJdGVtc0J5UGFnZSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgaWYoIWN0cmwudGFibGVTdGF0ZSgpLnBhZ2luYXRpb24ubnVtYmVyKXtcclxuICAgICAgICAgIGN0cmwuc2xpY2UoMCwgc2NvcGUuc3RJdGVtc0J5UGFnZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gIH0pO1xyXG4iLCJuZy5tb2R1bGUoJ3NtYXJ0LXRhYmxlJylcclxuICAuZGlyZWN0aXZlKCdzdFBhZ2luYXRpb25FeHRyYScsIGZ1bmN0aW9uICgpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHJlc3RyaWN0OiAnRUEnLFxyXG4gICAgICByZXF1aXJlOiAnXnN0VGFibGUnLFxyXG4gICAgICBzY29wZToge30sXHJcbiAgICAgIHRlbXBsYXRlVXJsOiBmdW5jdGlvbiAoZWxlbWVudCwgYXR0cnMpIHtcclxuICAgICAgICBpZiAoYXR0cnMuc3RUZW1wbGF0ZSkge1xyXG4gICAgICAgICAgcmV0dXJuIGF0dHJzLnN0VGVtcGxhdGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiAndGVtcGxhdGUvc21hcnQtdGFibGUvcGFnaW5hdGlvbmV4dHJhLmh0bWwnO1xyXG4gICAgICB9LFxyXG4gICAgICBsaW5rOiBmdW5jdGlvbiAoc2NvcGUsIGVsZW1lbnQsIGF0dHJzLCBjdHJsKSB7XHJcblxyXG4gICAgICAgIHNjb3BlLmZpcnN0SXRlbSA9IDE7XHJcblx0c2NvcGUubGFzdEl0ZW0gPSAxO1xyXG5cdHNjb3BlLnRvdGFsSXRlbXMgPSAxO1xyXG5cclxuICAgICAgICBmdW5jdGlvbiByZWRyYXcoKSB7XHJcbiAgICAgICAgICB2YXIgcGFnaW5hdGlvblN0YXRlID0gY3RybC50YWJsZVN0YXRlKCkucGFnaW5hdGlvbjtcclxuXHQgIHNjb3BlLmZpcnN0SXRlbSA9IE1hdGgubWluKHBhZ2luYXRpb25TdGF0ZS50b3RhbCwgcGFnaW5hdGlvblN0YXRlLnN0YXJ0ICsgMSk7XHJcblx0ICBzY29wZS5sYXN0SXRlbSA9IE1hdGgubWluKHBhZ2luYXRpb25TdGF0ZS50b3RhbCwgcGFnaW5hdGlvblN0YXRlLnN0YXJ0ICsgcGFnaW5hdGlvblN0YXRlLm51bWJlcik7XHJcblx0ICBzY29wZS50b3RhbEl0ZW1zID0gcGFnaW5hdGlvblN0YXRlLnRvdGFsO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy90YWJsZSBzdGF0ZSAtLT4gdmlld1xyXG4gICAgICAgIHNjb3BlLiR3YXRjaChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICByZXR1cm4gY3RybC50YWJsZVN0YXRlKCkucGFnaW5hdGlvbjtcclxuICAgICAgICB9LCByZWRyYXcsIHRydWUpO1xyXG5cdFxyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gIH0pO1xyXG4iLCJuZy5tb2R1bGUoJ3NtYXJ0LXRhYmxlJylcclxuICAuZGlyZWN0aXZlKCdzdFBhZ2luYXRpb25Ub3RhbCcsIGZ1bmN0aW9uICgpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHJlc3RyaWN0OiAnRUEnLFxyXG4gICAgICByZXF1aXJlOiAnXnN0VGFibGUnLFxyXG4gICAgICBzY29wZToge1xyXG4gICAgICAgIHN0VXB0b0xpbWl0OiAnPT8nLFxyXG4gICAgICB9LFxyXG4gICAgICB0ZW1wbGF0ZVVybDogZnVuY3Rpb24gKGVsZW1lbnQsIGF0dHJzKSB7XHJcbiAgICAgICAgaWYgKGF0dHJzLnN0VGVtcGxhdGUpIHtcclxuICAgICAgICAgIHJldHVybiBhdHRycy5zdFRlbXBsYXRlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gJ3RlbXBsYXRlL3NtYXJ0LXRhYmxlL3BhZ2luYXRpb250b3RhbC5odG1sJztcclxuICAgICAgfSxcclxuICAgICAgbGluazogZnVuY3Rpb24gKHNjb3BlLCBlbGVtZW50LCBhdHRycywgY3RybCkge1xyXG5cclxuICAgICAgICBzY29wZS5zdFVwdG9MaW1pdCA9IHNjb3BlLnN0VXB0b0xpbWl0ID8gKyhzY29wZS5zdFVwdG9MaW1pdCkgOiAxMDtcclxuXHQgICAgICBcclxuXHRzY29wZS5saW1pdEl0ZW1zID0gMTtcclxuXHRzY29wZS50b3RhbEl0ZW1zID0gMTtcclxuXHJcbiAgICAgICAgZnVuY3Rpb24gcmVkcmF3KCkge1xyXG4gICAgICAgICAgdmFyIHBhZ2luYXRpb25TdGF0ZSA9IGN0cmwudGFibGVTdGF0ZSgpLnBhZ2luYXRpb247XHJcblx0ICBzY29wZS5saW1pdEl0ZW1zID0gTWF0aC5taW4ocGFnaW5hdGlvblN0YXRlLnRvdGFsLCBzY29wZS5zdFVwdG9MaW1pdCk7XHJcblx0ICBzY29wZS50b3RhbEl0ZW1zID0gcGFnaW5hdGlvblN0YXRlLnRvdGFsO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy90YWJsZSBzdGF0ZSAtLT4gdmlld1xyXG4gICAgICAgIHNjb3BlLiR3YXRjaChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICByZXR1cm4gY3RybC50YWJsZVN0YXRlKCkucGFnaW5hdGlvbjtcclxuICAgICAgICB9LCByZWRyYXcsIHRydWUpO1xyXG5cclxuICAgICAgICAvL3Njb3BlIC0tPiB0YWJsZSBzdGF0ZSAgKC0tPiB2aWV3KVxyXG4gICAgICAgIHNjb3BlLiR3YXRjaCgnc3RVcHRvTGltaXQnLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XHJcbiAgICAgICAgICBpZiAobmV3VmFsdWUgIT09IG9sZFZhbHVlKSB7XHJcbiAgICAgICAgICAgIHJlZHJhdygpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cdFxyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gIH0pO1xyXG4iLCJuZy5tb2R1bGUoJ3NtYXJ0LXRhYmxlJylcclxuICAuZGlyZWN0aXZlKCdzdFBpcGUnLCBmdW5jdGlvbiAoKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICByZXF1aXJlOiAnc3RUYWJsZScsXHJcbiAgICAgIHNjb3BlOiB7XHJcbiAgICAgICAgc3RQaXBlOiAnPSdcclxuICAgICAgfSxcclxuICAgICAgbGluazoge1xyXG5cclxuICAgICAgICBwcmU6IGZ1bmN0aW9uIChzY29wZSwgZWxlbWVudCwgYXR0cnMsIGN0cmwpIHtcclxuICAgICAgICAgIGlmIChuZy5pc0Z1bmN0aW9uKHNjb3BlLnN0UGlwZSkpIHtcclxuICAgICAgICAgICAgY3RybC5wcmV2ZW50UGlwZU9uV2F0Y2goKTtcclxuICAgICAgICAgICAgY3RybC5waXBlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgIHJldHVybiBzY29wZS5zdFBpcGUoY3RybC50YWJsZVN0YXRlKCksIGN0cmwpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgcG9zdDogZnVuY3Rpb24gKHNjb3BlLCBlbGVtZW50LCBhdHRycywgY3RybCkge1xyXG4gICAgICAgICAgY3RybC5waXBlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gIH0pO1xyXG4iLCJ9KShhbmd1bGFyKTsiXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=