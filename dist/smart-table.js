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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy90b3AudHh0Iiwic3JjL3NtYXJ0LXRhYmxlLm1vZHVsZS5qcyIsInNyYy9zdFRhYmxlLmpzIiwic3JjL3N0U2VhcmNoLmpzIiwic3JjL3N0U2VsZWN0Um93LmpzIiwic3JjL3N0U29ydC5qcyIsInNyYy9zdFBhZ2luYXRpb24uanMiLCJzcmMvc3RQYWdpbmF0aW9uRXh0cmEuanMiLCJzcmMvc3RQYWdpbmF0aW9uVG90YWwuanMiLCJzcmMvc3RQaXBlLmpzIiwic3JjL2JvdHRvbS50eHQiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNoTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDL0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDMUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDeEJBIiwiZmlsZSI6InNtYXJ0LXRhYmxlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIChuZywgdW5kZWZpbmVkKXtcclxuICAgICd1c2Ugc3RyaWN0JztcclxuIiwibmcubW9kdWxlKCdzbWFydC10YWJsZScsIFtdKS5ydW4oWyckdGVtcGxhdGVDYWNoZScsIGZ1bmN0aW9uICgkdGVtcGxhdGVDYWNoZSkge1xyXG4gICAgJHRlbXBsYXRlQ2FjaGUucHV0KCd0ZW1wbGF0ZS9zbWFydC10YWJsZS9wYWdpbmF0aW9uLmh0bWwnLFxyXG4gICAgICAgICc8bmF2IG5nLWlmPVwicGFnZXMubGVuZ3RoID49IDJcIj48dWwgY2xhc3M9XCJwYWdpbmF0aW9uIHBhZ2luYXRpb24tc20gbm8tdG9wLW1hcmdpbiBuby1ib3R0b20tbWFyZ2luXCI+JyArXHJcbiAgICAgICAgJzxsaSBuZy1yZXBlYXQ9XCJwYWdlIGluIHBhZ2VzXCIgbmctY2xhc3M9XCJ7YWN0aXZlOiBwYWdlPT1jdXJyZW50UGFnZX1cIj48YSBuZy1jbGljaz1cInNlbGVjdFBhZ2UocGFnZSlcIj57e3BhZ2V9fTwvYT48L2xpPicgK1xyXG4gICAgICAgICc8L3VsPjwvbmF2PicpO1xyXG4gICAgJHRlbXBsYXRlQ2FjaGUucHV0KCd0ZW1wbGF0ZS9zbWFydC10YWJsZS9wYWdpbmF0aW9uZXh0cmEuaHRtbCcsXHJcbiAgICAgICAgJ3t7Zmlyc3RJdGVtfX0gdG8ge3tsYXN0SXRlbX19IG9mIHt7dG90YWxJdGVtc319Jyk7XHRcclxuICAgICR0ZW1wbGF0ZUNhY2hlLnB1dCgndGVtcGxhdGUvc21hcnQtdGFibGUvcGFnaW5hdGlvbnRvdGFsLmh0bWwnLFxyXG4gICAgICAgICd7e2xpbWl0SXRlbXN9fSBvZiB7e3RvdGFsSXRlbXN9fScpO1x0XHJcbn1dKTtcclxuXHJcbiIsIm5nLm1vZHVsZSgnc21hcnQtdGFibGUnKVxyXG4gIC5jb250cm9sbGVyKCdzdFRhYmxlQ29udHJvbGxlcicsIFsnJHNjb3BlJywgJyRwYXJzZScsICckZmlsdGVyJywgJyRhdHRycycsIGZ1bmN0aW9uIFN0VGFibGVDb250cm9sbGVyKCRzY29wZSwgJHBhcnNlLCAkZmlsdGVyLCAkYXR0cnMpIHtcclxuICAgIHZhciBwcm9wZXJ0eU5hbWUgPSAkYXR0cnMuc3RUYWJsZTtcclxuICAgIHZhciBkaXNwbGF5R2V0dGVyID0gJHBhcnNlKHByb3BlcnR5TmFtZSk7XHJcbiAgICB2YXIgZGlzcGxheVNldHRlciA9IGRpc3BsYXlHZXR0ZXIuYXNzaWduO1xyXG4gICAgdmFyIHNhZmVHZXR0ZXI7XHJcbiAgICB2YXIgb3JkZXJCeSA9ICRmaWx0ZXIoJ29yZGVyQnknKTtcclxuICAgIHZhciBmaWx0ZXIgPSAkZmlsdGVyKCdmaWx0ZXInKTtcclxuICAgIHZhciBzYWZlQ29weSA9IGNvcHlSZWZzKGRpc3BsYXlHZXR0ZXIoJHNjb3BlKSk7XHJcbiAgICB2YXIgdGFibGVTdGF0ZSA9IHtcclxuICAgICAgc29ydDoge30sXHJcbiAgICAgIHNlYXJjaDoge30sXHJcbiAgICAgIHBhZ2luYXRpb246IHtcclxuICAgICAgICBzdGFydDogMFxyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gICAgdmFyIHBpcGVBZnRlclNhZmVDb3B5ID0gdHJ1ZTtcclxuICAgIHZhciBjdHJsID0gdGhpcztcclxuICAgIHZhciBsYXN0U2VsZWN0ZWQ7XHJcblxyXG4gICAgZnVuY3Rpb24gY29weVJlZnMoc3JjKSB7XHJcbiAgICAgIHJldHVybiBzcmMgPyBbXS5jb25jYXQoc3JjKSA6IFtdO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHVwZGF0ZVNhZmVDb3B5KCkge1xyXG4gICAgICBzYWZlQ29weSA9IGNvcHlSZWZzKHNhZmVHZXR0ZXIoJHNjb3BlKSk7XHJcbiAgICAgIGlmIChwaXBlQWZ0ZXJTYWZlQ29weSA9PT0gdHJ1ZSkge1xyXG4gICAgICAgIGN0cmwucGlwZSgpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCRhdHRycy5zdFNhZmVTcmMpIHtcclxuICAgICAgc2FmZUdldHRlciA9ICRwYXJzZSgkYXR0cnMuc3RTYWZlU3JjKTtcclxuICAgICAgJHNjb3BlLiR3YXRjaChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIHNhZmVTcmMgPSBzYWZlR2V0dGVyKCRzY29wZSk7XHJcbiAgICAgICAgcmV0dXJuIHNhZmVTcmMgPyBzYWZlU3JjLmxlbmd0aCA6IDA7XHJcblxyXG4gICAgICB9LCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XHJcbiAgICAgICAgaWYgKG5ld1ZhbHVlICE9PSBzYWZlQ29weS5sZW5ndGgpIHtcclxuICAgICAgICAgIHVwZGF0ZVNhZmVDb3B5KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgICAgJHNjb3BlLiR3YXRjaChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHNhZmVHZXR0ZXIoJHNjb3BlKTtcclxuICAgICAgfSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xyXG4gICAgICAgIGlmIChuZXdWYWx1ZSAhPT0gb2xkVmFsdWUpIHtcclxuICAgICAgICAgIHVwZGF0ZVNhZmVDb3B5KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIHNvcnQgdGhlIHJvd3NcclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb24gfCBTdHJpbmd9IHByZWRpY2F0ZSAtIGZ1bmN0aW9uIG9yIHN0cmluZyB3aGljaCB3aWxsIGJlIHVzZWQgYXMgcHJlZGljYXRlIGZvciB0aGUgc29ydGluZ1xyXG4gICAgICogQHBhcmFtIFtyZXZlcnNlXSAtIGlmIHlvdSB3YW50IHRvIHJldmVyc2UgdGhlIG9yZGVyXHJcbiAgICAgKi9cclxuICAgIHRoaXMuc29ydEJ5ID0gZnVuY3Rpb24gc29ydEJ5KHByZWRpY2F0ZSwgcmV2ZXJzZSkge1xyXG4gICAgICB0YWJsZVN0YXRlLnNvcnQucHJlZGljYXRlID0gcHJlZGljYXRlO1xyXG4gICAgICB0YWJsZVN0YXRlLnNvcnQucmV2ZXJzZSA9IHJldmVyc2UgPT09IHRydWU7XHJcblxyXG4gICAgICBpZiAobmcuaXNGdW5jdGlvbihwcmVkaWNhdGUpKSB7XHJcbiAgICAgICAgdGFibGVTdGF0ZS5zb3J0LmZ1bmN0aW9uTmFtZSA9IHByZWRpY2F0ZS5uYW1lO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGRlbGV0ZSB0YWJsZVN0YXRlLnNvcnQuZnVuY3Rpb25OYW1lO1xyXG4gICAgICB9XHJcblxyXG4gICAgICB0YWJsZVN0YXRlLnBhZ2luYXRpb24uc3RhcnQgPSAwO1xyXG4gICAgICByZXR1cm4gdGhpcy5waXBlKCk7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogc2VhcmNoIG1hdGNoaW5nIHJvd3NcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBpbnB1dCAtIHRoZSBpbnB1dCBzdHJpbmdcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBbcHJlZGljYXRlXSAtIHRoZSBwcm9wZXJ0eSBuYW1lIGFnYWluc3QgeW91IHdhbnQgdG8gY2hlY2sgdGhlIG1hdGNoLCBvdGhlcndpc2UgaXQgd2lsbCBzZWFyY2ggb24gYWxsIHByb3BlcnRpZXNcclxuICAgICAqL1xyXG4gICAgdGhpcy5zZWFyY2ggPSBmdW5jdGlvbiBzZWFyY2goaW5wdXQsIHByZWRpY2F0ZSkge1xyXG4gICAgICB2YXIgcHJlZGljYXRlT2JqZWN0ID0gdGFibGVTdGF0ZS5zZWFyY2gucHJlZGljYXRlT2JqZWN0IHx8IHt9O1xyXG4gICAgICB2YXIgcHJvcCA9IHByZWRpY2F0ZSA/IHByZWRpY2F0ZSA6ICckJztcclxuXHJcbiAgICAgIGlucHV0ID0gbmcuaXNTdHJpbmcoaW5wdXQpID8gaW5wdXQudHJpbSgpIDogaW5wdXQ7XHJcbiAgICAgIHByZWRpY2F0ZU9iamVjdFtwcm9wXSA9IGlucHV0O1xyXG4gICAgICAvLyB0byBhdm9pZCB0byBmaWx0ZXIgb3V0IG51bGwgdmFsdWVcclxuICAgICAgaWYgKCFpbnB1dCkge1xyXG4gICAgICAgIGRlbGV0ZSBwcmVkaWNhdGVPYmplY3RbcHJvcF07XHJcbiAgICAgIH1cclxuICAgICAgdGFibGVTdGF0ZS5zZWFyY2gucHJlZGljYXRlT2JqZWN0ID0gcHJlZGljYXRlT2JqZWN0O1xyXG4gICAgICB0YWJsZVN0YXRlLnBhZ2luYXRpb24uc3RhcnQgPSAwO1xyXG4gICAgICByZXR1cm4gdGhpcy5waXBlKCk7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogdGhpcyB3aWxsIGNoYWluIHRoZSBvcGVyYXRpb25zIG9mIHNvcnRpbmcgYW5kIGZpbHRlcmluZyBiYXNlZCBvbiB0aGUgY3VycmVudCB0YWJsZSBzdGF0ZSAoc29ydCBvcHRpb25zLCBmaWx0ZXJpbmcsIGVjdClcclxuICAgICAqL1xyXG4gICAgdGhpcy5waXBlID0gZnVuY3Rpb24gcGlwZSgpIHtcclxuICAgICAgdmFyIHBhZ2luYXRpb24gPSB0YWJsZVN0YXRlLnBhZ2luYXRpb247XHJcbiAgICAgIHZhciBmaWx0ZXJlZCA9IHRhYmxlU3RhdGUuc2VhcmNoLnByZWRpY2F0ZU9iamVjdCA/IGZpbHRlcihzYWZlQ29weSwgdGFibGVTdGF0ZS5zZWFyY2gucHJlZGljYXRlT2JqZWN0KSA6IHNhZmVDb3B5O1xyXG4gICAgICBpZiAodGFibGVTdGF0ZS5zb3J0LnByZWRpY2F0ZSkge1xyXG4gICAgICAgIGZpbHRlcmVkID0gb3JkZXJCeShmaWx0ZXJlZCwgdGFibGVTdGF0ZS5zb3J0LnByZWRpY2F0ZSwgdGFibGVTdGF0ZS5zb3J0LnJldmVyc2UpO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICAvL01DIHJlY29yZCB0b3RhbCBvZiBmaWx0ZXJlZCBpdGVtc1xyXG4gICAgICBwYWdpbmF0aW9uLnRvdGFsID0gZmlsdGVyZWQubGVuZ3RoO1xyXG4gICAgICBcclxuICAgICAgaWYgKHBhZ2luYXRpb24ubnVtYmVyICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICBwYWdpbmF0aW9uLm51bWJlck9mUGFnZXMgPSBmaWx0ZXJlZC5sZW5ndGggPiAwID8gTWF0aC5jZWlsKGZpbHRlcmVkLmxlbmd0aCAvIHBhZ2luYXRpb24ubnVtYmVyKSA6IDE7XHJcbiAgICAgICAgcGFnaW5hdGlvbi5zdGFydCA9IHBhZ2luYXRpb24uc3RhcnQgPj0gZmlsdGVyZWQubGVuZ3RoID8gKHBhZ2luYXRpb24ubnVtYmVyT2ZQYWdlcyAtIDEpICogcGFnaW5hdGlvbi5udW1iZXIgOiBwYWdpbmF0aW9uLnN0YXJ0O1xyXG4gICAgICAgIGZpbHRlcmVkID0gZmlsdGVyZWQuc2xpY2UocGFnaW5hdGlvbi5zdGFydCwgcGFnaW5hdGlvbi5zdGFydCArIHBhcnNlSW50KHBhZ2luYXRpb24ubnVtYmVyKSk7XHJcbiAgICAgIH1cclxuICAgICAgZGlzcGxheVNldHRlcigkc2NvcGUsIGZpbHRlcmVkKTtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBzZWxlY3QgYSBkYXRhUm93IChpdCB3aWxsIGFkZCB0aGUgYXR0cmlidXRlIGlzU2VsZWN0ZWQgdG8gdGhlIHJvdyBvYmplY3QpXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcm93IC0gdGhlIHJvdyB0byBzZWxlY3RcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBbbW9kZV0gLSBcInNpbmdsZVwiIG9yIFwibXVsdGlwbGVcIiAobXVsdGlwbGUgYnkgZGVmYXVsdClcclxuICAgICAqL1xyXG4gICAgdGhpcy5zZWxlY3QgPSBmdW5jdGlvbiBzZWxlY3Qocm93LCBtb2RlKSB7XHJcbiAgICAgIHZhciByb3dzID0gc2FmZUNvcHk7XHJcbiAgICAgIHZhciBpbmRleCA9IHJvd3MuaW5kZXhPZihyb3cpO1xyXG4gICAgICBpZiAoaW5kZXggIT09IC0xKSB7XHJcbiAgICAgICAgaWYgKG1vZGUgPT09ICdzaW5nbGUnKSB7XHJcbiAgICAgICAgICByb3cuaXNTZWxlY3RlZCA9IHJvdy5pc1NlbGVjdGVkICE9PSB0cnVlO1xyXG4gICAgICAgICAgaWYgKGxhc3RTZWxlY3RlZCkge1xyXG4gICAgICAgICAgICBsYXN0U2VsZWN0ZWQuaXNTZWxlY3RlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgbGFzdFNlbGVjdGVkID0gcm93LmlzU2VsZWN0ZWQgPT09IHRydWUgPyByb3cgOiB1bmRlZmluZWQ7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHJvd3NbaW5kZXhdLmlzU2VsZWN0ZWQgPSAhcm93c1tpbmRleF0uaXNTZWxlY3RlZDtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiB0YWtlIGEgc2xpY2Ugb2YgdGhlIGN1cnJlbnQgc29ydGVkL2ZpbHRlcmVkIGNvbGxlY3Rpb24gKHBhZ2luYXRpb24pXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHN0YXJ0IC0gc3RhcnQgaW5kZXggb2YgdGhlIHNsaWNlXHJcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gbnVtYmVyIC0gdGhlIG51bWJlciBvZiBpdGVtIGluIHRoZSBzbGljZVxyXG4gICAgICovXHJcbiAgICB0aGlzLnNsaWNlID0gZnVuY3Rpb24gc3BsaWNlKHN0YXJ0LCBudW1iZXIpIHtcclxuICAgICAgdGFibGVTdGF0ZS5wYWdpbmF0aW9uLnN0YXJ0ID0gc3RhcnQ7XHJcbiAgICAgIHRhYmxlU3RhdGUucGFnaW5hdGlvbi5udW1iZXIgPSBudW1iZXI7XHJcbiAgICAgIHJldHVybiB0aGlzLnBpcGUoKTtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiByZXR1cm4gdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlIHRhYmxlXHJcbiAgICAgKiBAcmV0dXJucyB7e3NvcnQ6IHt9LCBzZWFyY2g6IHt9LCBwYWdpbmF0aW9uOiB7c3RhcnQ6IG51bWJlcn19fVxyXG4gICAgICovXHJcbiAgICB0aGlzLnRhYmxlU3RhdGUgPSBmdW5jdGlvbiBnZXRUYWJsZVN0YXRlKCkge1xyXG4gICAgICByZXR1cm4gdGFibGVTdGF0ZTtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBVc2UgYSBkaWZmZXJlbnQgZmlsdGVyIGZ1bmN0aW9uIHRoYW4gdGhlIGFuZ3VsYXIgRmlsdGVyRmlsdGVyXHJcbiAgICAgKiBAcGFyYW0gZmlsdGVyTmFtZSB0aGUgbmFtZSB1bmRlciB3aGljaCB0aGUgY3VzdG9tIGZpbHRlciBpcyByZWdpc3RlcmVkXHJcbiAgICAgKi9cclxuICAgIHRoaXMuc2V0RmlsdGVyRnVuY3Rpb24gPSBmdW5jdGlvbiBzZXRGaWx0ZXJGdW5jdGlvbihmaWx0ZXJOYW1lKSB7XHJcbiAgICAgIGZpbHRlciA9ICRmaWx0ZXIoZmlsdGVyTmFtZSk7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICpVc2VyIGEgZGlmZmVyZW50IGZ1bmN0aW9uIHRoYW4gdGhlIGFuZ3VsYXIgb3JkZXJCeVxyXG4gICAgICogQHBhcmFtIHNvcnRGdW5jdGlvbk5hbWUgdGhlIG5hbWUgdW5kZXIgd2hpY2ggdGhlIGN1c3RvbSBvcmRlciBmdW5jdGlvbiBpcyByZWdpc3RlcmVkXHJcbiAgICAgKi9cclxuICAgIHRoaXMuc2V0U29ydEZ1bmN0aW9uID0gZnVuY3Rpb24gc2V0U29ydEZ1bmN0aW9uKHNvcnRGdW5jdGlvbk5hbWUpIHtcclxuICAgICAgb3JkZXJCeSA9ICRmaWx0ZXIoc29ydEZ1bmN0aW9uTmFtZSk7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVXN1YWxseSB3aGVuIHRoZSBzYWZlIGNvcHkgaXMgdXBkYXRlZCB0aGUgcGlwZSBmdW5jdGlvbiBpcyBjYWxsZWQuXHJcbiAgICAgKiBDYWxsaW5nIHRoaXMgbWV0aG9kIHdpbGwgcHJldmVudCBpdCwgd2hpY2ggaXMgc29tZXRoaW5nIHJlcXVpcmVkIHdoZW4gdXNpbmcgYSBjdXN0b20gcGlwZSBmdW5jdGlvblxyXG4gICAgICovXHJcbiAgICB0aGlzLnByZXZlbnRQaXBlT25XYXRjaCA9IGZ1bmN0aW9uIHByZXZlbnRQaXBlKCkge1xyXG4gICAgICBwaXBlQWZ0ZXJTYWZlQ29weSA9IGZhbHNlO1xyXG4gICAgfTtcclxuICB9XSlcclxuICAuZGlyZWN0aXZlKCdzdFRhYmxlJywgZnVuY3Rpb24gKCkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgcmVzdHJpY3Q6ICdBJyxcclxuICAgICAgY29udHJvbGxlcjogJ3N0VGFibGVDb250cm9sbGVyJyxcclxuICAgICAgbGluazogZnVuY3Rpb24gKHNjb3BlLCBlbGVtZW50LCBhdHRyLCBjdHJsKSB7XHJcblxyXG4gICAgICAgIGlmIChhdHRyLnN0U2V0RmlsdGVyKSB7XHJcbiAgICAgICAgICBjdHJsLnNldEZpbHRlckZ1bmN0aW9uKGF0dHIuc3RTZXRGaWx0ZXIpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGF0dHIuc3RTZXRTb3J0KSB7XHJcbiAgICAgICAgICBjdHJsLnNldFNvcnRGdW5jdGlvbihhdHRyLnN0U2V0U29ydCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gIH0pO1xyXG4iLCJuZy5tb2R1bGUoJ3NtYXJ0LXRhYmxlJylcclxuICAgIC5kaXJlY3RpdmUoJ3N0U2VhcmNoJywgWyckdGltZW91dCcsIGZ1bmN0aW9uICgkdGltZW91dCkge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHJlcXVpcmU6ICdec3RUYWJsZScsXHJcbiAgICAgICAgICAgIHNjb3BlOiB7XHJcbiAgICAgICAgICAgICAgICBwcmVkaWNhdGU6ICc9P3N0U2VhcmNoJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBsaW5rOiBmdW5jdGlvbiAoc2NvcGUsIGVsZW1lbnQsIGF0dHIsIGN0cmwpIHtcclxuICAgICAgICAgICAgICAgIHZhciB0YWJsZUN0cmwgPSBjdHJsO1xyXG4gICAgICAgICAgICAgICAgdmFyIHByb21pc2UgPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgdmFyIHRocm90dGxlID0gYXR0ci5zdERlbGF5IHx8IDQwMDtcclxuXHJcbiAgICAgICAgICAgICAgICBzY29wZS4kd2F0Y2goJ3ByZWRpY2F0ZScsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAobmV3VmFsdWUgIT09IG9sZFZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGN0cmwudGFibGVTdGF0ZSgpLnNlYXJjaCA9IHt9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0YWJsZUN0cmwuc2VhcmNoKGVsZW1lbnRbMF0udmFsdWUgfHwgJycsIG5ld1ZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAvL3RhYmxlIHN0YXRlIC0+IHZpZXdcclxuICAgICAgICAgICAgICAgIHNjb3BlLiR3YXRjaChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGN0cmwudGFibGVTdGF0ZSgpLnNlYXJjaDtcclxuICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgcHJlZGljYXRlRXhwcmVzc2lvbiA9IHNjb3BlLnByZWRpY2F0ZSB8fCAnJCc7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5ld1ZhbHVlLnByZWRpY2F0ZU9iamVjdCAmJiBuZXdWYWx1ZS5wcmVkaWNhdGVPYmplY3RbcHJlZGljYXRlRXhwcmVzc2lvbl0gIT09IGVsZW1lbnRbMF0udmFsdWUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudFswXS52YWx1ZSA9IG5ld1ZhbHVlLnByZWRpY2F0ZU9iamVjdFtwcmVkaWNhdGVFeHByZXNzaW9uXSB8fCAnJztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LCB0cnVlKTtcclxuXHJcblx0XHRmdW5jdGlvbiBzZWFyY2hGaWx0ZXIoZXZ0KSB7XHJcblx0XHQgICAgZXZ0ID0gZXZ0Lm9yaWdpbmFsRXZlbnQgfHwgZXZ0O1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9taXNlICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICR0aW1lb3V0LmNhbmNlbChwcm9taXNlKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgcHJvbWlzZSA9ICR0aW1lb3V0KGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGFibGVDdHJsLnNlYXJjaChldnQudGFyZ2V0LnZhbHVlLCBzY29wZS5wcmVkaWNhdGUgfHwgJycpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9taXNlID0gbnVsbDtcclxuICAgICAgICAgICAgICAgICAgICB9LCB0aHJvdHRsZSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblx0XHRcclxuICAgICAgICAgICAgICAgIC8vIHZpZXcgLT4gdGFibGUgc3RhdGVcclxuXHRcdGlmIChlbGVtZW50LnByb3AoJ3RhZ05hbWUnKSA9PSAnU0VMRUNUJykge1xyXG5cdFx0XHRlbGVtZW50LmJpbmQoJ2NoYW5nZScsIHNlYXJjaEZpbHRlcik7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRlbGVtZW50LmJpbmQoJ2lucHV0Jywgc2VhcmNoRmlsdGVyKTtcclxuXHRcdH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICB9XSk7XHJcbiIsIm5nLm1vZHVsZSgnc21hcnQtdGFibGUnKVxyXG4gIC5kaXJlY3RpdmUoJ3N0U2VsZWN0Um93JywgZnVuY3Rpb24gKCkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgcmVzdHJpY3Q6ICdBJyxcclxuICAgICAgcmVxdWlyZTogJ15zdFRhYmxlJyxcclxuICAgICAgc2NvcGU6IHtcclxuICAgICAgICByb3c6ICc9c3RTZWxlY3RSb3cnXHJcbiAgICAgIH0sXHJcbiAgICAgIGxpbms6IGZ1bmN0aW9uIChzY29wZSwgZWxlbWVudCwgYXR0ciwgY3RybCkge1xyXG4gICAgICAgIHZhciBtb2RlID0gYXR0ci5zdFNlbGVjdE1vZGUgfHwgJ3NpbmdsZSc7XHJcbiAgICAgICAgZWxlbWVudC5iaW5kKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgIHNjb3BlLiRhcHBseShmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGN0cmwuc2VsZWN0KHNjb3BlLnJvdywgbW9kZSk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgc2NvcGUuJHdhdGNoKCdyb3cuaXNTZWxlY3RlZCcsIGZ1bmN0aW9uIChuZXdWYWx1ZSkge1xyXG4gICAgICAgICAgaWYgKG5ld1ZhbHVlID09PSB0cnVlKSB7XHJcbiAgICAgICAgICAgIGVsZW1lbnQuYWRkQ2xhc3MoJ3N0LXNlbGVjdGVkJyk7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBlbGVtZW50LnJlbW92ZUNsYXNzKCdzdC1zZWxlY3RlZCcpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gIH0pO1xyXG4iLCJuZy5tb2R1bGUoJ3NtYXJ0LXRhYmxlJylcclxuICAuZGlyZWN0aXZlKCdzdFNvcnQnLCBbJyRwYXJzZScsIGZ1bmN0aW9uICgkcGFyc2UpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHJlc3RyaWN0OiAnQScsXHJcbiAgICAgIHJlcXVpcmU6ICdec3RUYWJsZScsXHJcbiAgICAgIGxpbms6IGZ1bmN0aW9uIChzY29wZSwgZWxlbWVudCwgYXR0ciwgY3RybCkge1xyXG5cclxuICAgICAgICB2YXIgcHJlZGljYXRlID0gYXR0ci5zdFNvcnQ7XHJcbiAgICAgICAgdmFyIGdldHRlciA9ICRwYXJzZShwcmVkaWNhdGUpO1xyXG4gICAgICAgIHZhciBpbmRleCA9IDA7XHJcbiAgICAgICAgdmFyIGNsYXNzQXNjZW50ID0gYXR0ci5zdENsYXNzQXNjZW50IHx8ICdzdC1zb3J0LWFzY2VudCc7XHJcbiAgICAgICAgdmFyIGNsYXNzRGVzY2VudCA9IGF0dHIuc3RDbGFzc0Rlc2NlbnQgfHwgJ3N0LXNvcnQtZGVzY2VudCc7XHJcbiAgICAgICAgdmFyIHN0YXRlQ2xhc3NlcyA9IFtjbGFzc0FzY2VudCwgY2xhc3NEZXNjZW50XTtcclxuICAgICAgICB2YXIgc29ydERlZmF1bHQ7XHJcblxyXG4gICAgICAgIGlmIChhdHRyLnN0U29ydERlZmF1bHQpIHtcclxuICAgICAgICAgIHNvcnREZWZhdWx0ID0gc2NvcGUuJGV2YWwoYXR0ci5zdFNvcnREZWZhdWx0KSAhPT0gdW5kZWZpbmVkID8gIHNjb3BlLiRldmFsKGF0dHIuc3RTb3J0RGVmYXVsdCkgOiBhdHRyLnN0U29ydERlZmF1bHQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL3ZpZXcgLS0+IHRhYmxlIHN0YXRlXHJcbiAgICAgICAgZnVuY3Rpb24gc29ydCgpIHtcclxuICAgICAgICAgIGluZGV4Kys7XHJcbiAgICAgICAgICBwcmVkaWNhdGUgPSBuZy5pc0Z1bmN0aW9uKGdldHRlcihzY29wZSkpID8gZ2V0dGVyKHNjb3BlKSA6IGF0dHIuc3RTb3J0O1xyXG4gICAgICAgICAgaWYgKGluZGV4ICUgMyA9PT0gMCAmJiBhdHRyLnN0U2tpcE5hdHVyYWwgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAvL21hbnVhbCByZXNldFxyXG4gICAgICAgICAgICBpbmRleCA9IDA7XHJcbiAgICAgICAgICAgIGN0cmwudGFibGVTdGF0ZSgpLnNvcnQgPSB7fTtcclxuICAgICAgICAgICAgY3RybC50YWJsZVN0YXRlKCkucGFnaW5hdGlvbi5zdGFydCA9IDA7XHJcbiAgICAgICAgICAgIGN0cmwucGlwZSgpO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY3RybC5zb3J0QnkocHJlZGljYXRlLCBpbmRleCAlIDIgPT09IDApO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZWxlbWVudC5iaW5kKCdjbGljaycsIGZ1bmN0aW9uIHNvcnRDbGljaygpIHtcclxuICAgICAgICAgIGlmIChwcmVkaWNhdGUpIHtcclxuICAgICAgICAgICAgc2NvcGUuJGFwcGx5KHNvcnQpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBpZiAoc29ydERlZmF1bHQpIHtcclxuICAgICAgICAgIGluZGV4ID0gYXR0ci5zdFNvcnREZWZhdWx0ID09PSAncmV2ZXJzZScgPyAxIDogMDtcclxuICAgICAgICAgIHNvcnQoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vdGFibGUgc3RhdGUgLS0+IHZpZXdcclxuICAgICAgICBzY29wZS4kd2F0Y2goZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgcmV0dXJuIGN0cmwudGFibGVTdGF0ZSgpLnNvcnQ7XHJcbiAgICAgICAgfSwgZnVuY3Rpb24gKG5ld1ZhbHVlKSB7XHJcbiAgICAgICAgICBpZiAobmV3VmFsdWUucHJlZGljYXRlICE9PSBwcmVkaWNhdGUpIHtcclxuICAgICAgICAgICAgaW5kZXggPSAwO1xyXG4gICAgICAgICAgICBlbGVtZW50XHJcbiAgICAgICAgICAgICAgLnJlbW92ZUNsYXNzKGNsYXNzQXNjZW50KVxyXG4gICAgICAgICAgICAgIC5yZW1vdmVDbGFzcyhjbGFzc0Rlc2NlbnQpO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgaW5kZXggPSBuZXdWYWx1ZS5yZXZlcnNlID09PSB0cnVlID8gMiA6IDE7XHJcbiAgICAgICAgICAgIGVsZW1lbnRcclxuICAgICAgICAgICAgICAucmVtb3ZlQ2xhc3Moc3RhdGVDbGFzc2VzW2luZGV4ICUgMl0pXHJcbiAgICAgICAgICAgICAgLmFkZENsYXNzKHN0YXRlQ2xhc3Nlc1tpbmRleCAtIDFdKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LCB0cnVlKTtcclxuICAgICAgfVxyXG4gICAgfTtcclxuICB9XSk7XHJcbiIsIm5nLm1vZHVsZSgnc21hcnQtdGFibGUnKVxyXG4gIC5kaXJlY3RpdmUoJ3N0UGFnaW5hdGlvbicsIGZ1bmN0aW9uICgpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHJlc3RyaWN0OiAnRUEnLFxyXG4gICAgICByZXF1aXJlOiAnXnN0VGFibGUnLFxyXG4gICAgICBzY29wZToge1xyXG4gICAgICAgIHN0SXRlbXNCeVBhZ2U6ICc9PycsXHJcbiAgICAgICAgc3REaXNwbGF5ZWRQYWdlczogJz0/JyxcclxuICAgICAgICBzdFBhZ2VDaGFuZ2U6ICcmJ1xyXG4gICAgICB9LFxyXG4gICAgICB0ZW1wbGF0ZVVybDogZnVuY3Rpb24gKGVsZW1lbnQsIGF0dHJzKSB7XHJcbiAgICAgICAgaWYgKGF0dHJzLnN0VGVtcGxhdGUpIHtcclxuICAgICAgICAgIHJldHVybiBhdHRycy5zdFRlbXBsYXRlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gJ3RlbXBsYXRlL3NtYXJ0LXRhYmxlL3BhZ2luYXRpb24uaHRtbCc7XHJcbiAgICAgIH0sXHJcbiAgICAgIGxpbms6IGZ1bmN0aW9uIChzY29wZSwgZWxlbWVudCwgYXR0cnMsIGN0cmwpIHtcclxuXHJcbiAgICAgICAgc2NvcGUuc3RJdGVtc0J5UGFnZSA9IHNjb3BlLnN0SXRlbXNCeVBhZ2UgPyArKHNjb3BlLnN0SXRlbXNCeVBhZ2UpIDogMTA7XHJcbiAgICAgICAgc2NvcGUuc3REaXNwbGF5ZWRQYWdlcyA9IHNjb3BlLnN0RGlzcGxheWVkUGFnZXMgPyArKHNjb3BlLnN0RGlzcGxheWVkUGFnZXMpIDogNTtcclxuXHJcbiAgICAgICAgc2NvcGUuY3VycmVudFBhZ2UgPSAxO1xyXG4gICAgICAgIHNjb3BlLnBhZ2VzID0gW107XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIHJlZHJhdygpIHtcclxuICAgICAgICAgIHZhciBwYWdpbmF0aW9uU3RhdGUgPSBjdHJsLnRhYmxlU3RhdGUoKS5wYWdpbmF0aW9uO1xyXG4gICAgICAgICAgdmFyIHN0YXJ0ID0gMTtcclxuICAgICAgICAgIHZhciBlbmQ7XHJcbiAgICAgICAgICB2YXIgaTtcclxuICAgICAgICAgIHZhciBwcmV2UGFnZSA9IHNjb3BlLmN1cnJlbnRQYWdlO1xyXG4gICAgICAgICAgc2NvcGUuY3VycmVudFBhZ2UgPSBNYXRoLmZsb29yKHBhZ2luYXRpb25TdGF0ZS5zdGFydCAvIHBhZ2luYXRpb25TdGF0ZS5udW1iZXIpICsgMTtcclxuXHJcbiAgICAgICAgICBzdGFydCA9IE1hdGgubWF4KHN0YXJ0LCBzY29wZS5jdXJyZW50UGFnZSAtIE1hdGguYWJzKE1hdGguZmxvb3Ioc2NvcGUuc3REaXNwbGF5ZWRQYWdlcyAvIDIpKSk7XHJcbiAgICAgICAgICBlbmQgPSBzdGFydCArIHNjb3BlLnN0RGlzcGxheWVkUGFnZXM7XHJcblxyXG4gICAgICAgICAgaWYgKGVuZCA+IHBhZ2luYXRpb25TdGF0ZS5udW1iZXJPZlBhZ2VzKSB7XHJcbiAgICAgICAgICAgIGVuZCA9IHBhZ2luYXRpb25TdGF0ZS5udW1iZXJPZlBhZ2VzICsgMTtcclxuICAgICAgICAgICAgc3RhcnQgPSBNYXRoLm1heCgxLCBlbmQgLSBzY29wZS5zdERpc3BsYXllZFBhZ2VzKTtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICBzY29wZS5wYWdlcyA9IFtdO1xyXG4gICAgICAgICAgc2NvcGUubnVtUGFnZXMgPSBwYWdpbmF0aW9uU3RhdGUubnVtYmVyT2ZQYWdlcztcclxuXHJcbiAgICAgICAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHNjb3BlLnBhZ2VzLnB1c2goaSk7XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgaWYgKHByZXZQYWdlIT09c2NvcGUuY3VycmVudFBhZ2UpIHtcclxuICAgICAgICAgICAgc2NvcGUuc3RQYWdlQ2hhbmdlKHtuZXdQYWdlOiBzY29wZS5jdXJyZW50UGFnZX0pO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy90YWJsZSBzdGF0ZSAtLT4gdmlld1xyXG4gICAgICAgIHNjb3BlLiR3YXRjaChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICByZXR1cm4gY3RybC50YWJsZVN0YXRlKCkucGFnaW5hdGlvbjtcclxuICAgICAgICB9LCByZWRyYXcsIHRydWUpO1xyXG5cclxuICAgICAgICAvL3Njb3BlIC0tPiB0YWJsZSBzdGF0ZSAgKC0tPiB2aWV3KVxyXG4gICAgICAgIHNjb3BlLiR3YXRjaCgnc3RJdGVtc0J5UGFnZScsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcclxuICAgICAgICAgIGlmIChuZXdWYWx1ZSAhPT0gb2xkVmFsdWUpIHtcclxuICAgICAgICAgICAgc2NvcGUuc2VsZWN0UGFnZSgxKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgc2NvcGUuJHdhdGNoKCdzdERpc3BsYXllZFBhZ2VzJywgcmVkcmF3KTtcclxuXHJcbiAgICAgICAgLy92aWV3IC0+IHRhYmxlIHN0YXRlXHJcbiAgICAgICAgc2NvcGUuc2VsZWN0UGFnZSA9IGZ1bmN0aW9uIChwYWdlKSB7XHJcbiAgICAgICAgICBpZiAocGFnZSA+IDAgJiYgcGFnZSA8PSBzY29wZS5udW1QYWdlcykge1xyXG4gICAgICAgICAgICBjdHJsLnNsaWNlKChwYWdlIC0gMSkgKiBzY29wZS5zdEl0ZW1zQnlQYWdlLCBzY29wZS5zdEl0ZW1zQnlQYWdlKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBpZighY3RybC50YWJsZVN0YXRlKCkucGFnaW5hdGlvbi5udW1iZXIpe1xyXG4gICAgICAgICAgY3RybC5zbGljZSgwLCBzY29wZS5zdEl0ZW1zQnlQYWdlKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgfSk7XHJcbiIsIm5nLm1vZHVsZSgnc21hcnQtdGFibGUnKVxyXG4gIC5kaXJlY3RpdmUoJ3N0UGFnaW5hdGlvbkV4dHJhJywgZnVuY3Rpb24gKCkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgcmVzdHJpY3Q6ICdFQScsXHJcbiAgICAgIHJlcXVpcmU6ICdec3RUYWJsZScsXHJcbiAgICAgIHNjb3BlOiB7fSxcclxuICAgICAgdGVtcGxhdGVVcmw6IGZ1bmN0aW9uIChlbGVtZW50LCBhdHRycykge1xyXG4gICAgICAgIGlmIChhdHRycy5zdFRlbXBsYXRlKSB7XHJcbiAgICAgICAgICByZXR1cm4gYXR0cnMuc3RUZW1wbGF0ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuICd0ZW1wbGF0ZS9zbWFydC10YWJsZS9wYWdpbmF0aW9uZXh0cmEuaHRtbCc7XHJcbiAgICAgIH0sXHJcbiAgICAgIGxpbms6IGZ1bmN0aW9uIChzY29wZSwgZWxlbWVudCwgYXR0cnMsIGN0cmwpIHtcclxuXHJcbiAgICAgICAgc2NvcGUuZmlyc3RJdGVtID0gMTtcclxuXHRzY29wZS5sYXN0SXRlbSA9IDE7XHJcblx0c2NvcGUudG90YWxJdGVtcyA9IDE7XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIHJlZHJhdygpIHtcclxuICAgICAgICAgIHZhciBwYWdpbmF0aW9uU3RhdGUgPSBjdHJsLnRhYmxlU3RhdGUoKS5wYWdpbmF0aW9uO1xyXG5cdCAgc2NvcGUuZmlyc3RJdGVtID0gTWF0aC5taW4ocGFnaW5hdGlvblN0YXRlLnRvdGFsLCBwYWdpbmF0aW9uU3RhdGUuc3RhcnQgKyAxKTtcclxuXHQgIHNjb3BlLmxhc3RJdGVtID0gTWF0aC5taW4ocGFnaW5hdGlvblN0YXRlLnRvdGFsLCBwYWdpbmF0aW9uU3RhdGUuc3RhcnQgKyBwYWdpbmF0aW9uU3RhdGUubnVtYmVyKTtcclxuXHQgIHNjb3BlLnRvdGFsSXRlbXMgPSBwYWdpbmF0aW9uU3RhdGUudG90YWw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL3RhYmxlIHN0YXRlIC0tPiB2aWV3XHJcbiAgICAgICAgc2NvcGUuJHdhdGNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgIHJldHVybiBjdHJsLnRhYmxlU3RhdGUoKS5wYWdpbmF0aW9uO1xyXG4gICAgICAgIH0sIHJlZHJhdywgdHJ1ZSk7XHJcblx0XHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgfSk7XHJcbiIsIm5nLm1vZHVsZSgnc21hcnQtdGFibGUnKVxyXG4gIC5kaXJlY3RpdmUoJ3N0UGFnaW5hdGlvblRvdGFsJywgZnVuY3Rpb24gKCkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgcmVzdHJpY3Q6ICdFQScsXHJcbiAgICAgIHJlcXVpcmU6ICdec3RUYWJsZScsXHJcbiAgICAgIHNjb3BlOiB7XHJcbiAgICAgICAgc3RVcHRvTGltaXQ6ICc9PycsXHJcbiAgICAgIH0sXHJcbiAgICAgIHRlbXBsYXRlVXJsOiBmdW5jdGlvbiAoZWxlbWVudCwgYXR0cnMpIHtcclxuICAgICAgICBpZiAoYXR0cnMuc3RUZW1wbGF0ZSkge1xyXG4gICAgICAgICAgcmV0dXJuIGF0dHJzLnN0VGVtcGxhdGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiAndGVtcGxhdGUvc21hcnQtdGFibGUvcGFnaW5hdGlvbnRvdGFsLmh0bWwnO1xyXG4gICAgICB9LFxyXG4gICAgICBsaW5rOiBmdW5jdGlvbiAoc2NvcGUsIGVsZW1lbnQsIGF0dHJzLCBjdHJsKSB7XHJcblxyXG4gICAgICAgIHNjb3BlLnN0VXB0b0xpbWl0ID0gc2NvcGUuc3RVcHRvTGltaXQgPyArKHNjb3BlLnN0VXB0b0xpbWl0KSA6IDEwO1xyXG5cdCAgICAgIFxyXG5cdHNjb3BlLmxpbWl0SXRlbXMgPSAxO1xyXG5cdHNjb3BlLnRvdGFsSXRlbXMgPSAxO1xyXG5cclxuICAgICAgICBmdW5jdGlvbiByZWRyYXcoKSB7XHJcbiAgICAgICAgICB2YXIgcGFnaW5hdGlvblN0YXRlID0gY3RybC50YWJsZVN0YXRlKCkucGFnaW5hdGlvbjtcclxuXHQgIHNjb3BlLmxpbWl0SXRlbXMgPSBNYXRoLm1pbihwYWdpbmF0aW9uU3RhdGUudG90YWwsIHNjb3BlLnN0VXB0b0xpbWl0KTtcclxuXHQgIHNjb3BlLnRvdGFsSXRlbXMgPSBwYWdpbmF0aW9uU3RhdGUudG90YWw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL3RhYmxlIHN0YXRlIC0tPiB2aWV3XHJcbiAgICAgICAgc2NvcGUuJHdhdGNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgIHJldHVybiBjdHJsLnRhYmxlU3RhdGUoKS5wYWdpbmF0aW9uO1xyXG4gICAgICAgIH0sIHJlZHJhdywgdHJ1ZSk7XHJcblxyXG4gICAgICAgIC8vc2NvcGUgLS0+IHRhYmxlIHN0YXRlICAoLS0+IHZpZXcpXHJcbiAgICAgICAgc2NvcGUuJHdhdGNoKCdzdFVwdG9MaW1pdCcsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcclxuICAgICAgICAgIGlmIChuZXdWYWx1ZSAhPT0gb2xkVmFsdWUpIHtcclxuICAgICAgICAgICAgcmVkcmF3KCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblx0XHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgfSk7XHJcbiIsIm5nLm1vZHVsZSgnc21hcnQtdGFibGUnKVxyXG4gIC5kaXJlY3RpdmUoJ3N0UGlwZScsIGZ1bmN0aW9uICgpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHJlcXVpcmU6ICdzdFRhYmxlJyxcclxuICAgICAgc2NvcGU6IHtcclxuICAgICAgICBzdFBpcGU6ICc9J1xyXG4gICAgICB9LFxyXG4gICAgICBsaW5rOiB7XHJcblxyXG4gICAgICAgIHByZTogZnVuY3Rpb24gKHNjb3BlLCBlbGVtZW50LCBhdHRycywgY3RybCkge1xyXG4gICAgICAgICAgaWYgKG5nLmlzRnVuY3Rpb24oc2NvcGUuc3RQaXBlKSkge1xyXG4gICAgICAgICAgICBjdHJsLnByZXZlbnRQaXBlT25XYXRjaCgpO1xyXG4gICAgICAgICAgICBjdHJsLnBpcGUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIHNjb3BlLnN0UGlwZShjdHJsLnRhYmxlU3RhdGUoKSwgY3RybCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBwb3N0OiBmdW5jdGlvbiAoc2NvcGUsIGVsZW1lbnQsIGF0dHJzLCBjdHJsKSB7XHJcbiAgICAgICAgICBjdHJsLnBpcGUoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgfSk7XHJcbiIsIn0pKGFuZ3VsYXIpOyJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==