ng.module('smart-table', []).run(['$templateCache', function ($templateCache) {
    $templateCache.put('template/smart-table/pagination.html',
        '<nav ng-if="pages.length >= 2"><ul class="pagination pagination-sm no-top-margin no-bottom-margin">' +
        '<li ng-repeat="page in pages" ng-class="{active: page==currentPage}"><a ng-click="selectPage(page)">{{page}}</a></li>' +
        '</ul></nav>');
    $templateCache.put('template/smart-table/paginationextra.html',
        '{{firstItem}} to {{lastItem}} of {{totalItems}}');	
}]);

