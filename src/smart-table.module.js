ng.module('smart-table', []).run(['$templateCache', function ($templateCache) {
    $templateCache.put('template/smart-table/pagination.html',
        '<ul class="pagination pagination-sm no-top-margin no-bottom-margin" ng-if="pages.length >= 2">' +
        '<li ng-repeat="page in pages" ng-class="{active: page==currentPage}"><a ng-click="selectPage(page)">{{page}}</a></li>' +
        '</ul>');
    $templateCache.put('template/smart-table/paginationextra.html',
        '{{firstItem}} to {{lastItem}} of {{totalItems}}');	
}]);

