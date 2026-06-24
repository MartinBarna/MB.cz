module.exports = {
  css: ['assets/vendor/bootstrap/bootstrap.min.css'],
  content: ['**/*.html', '!**/_zaloha/**', '!**/node_modules/**', 'assets/**/*.js'],
  // Ponech vše dynamické (přepíná JS) i bootstrap stavové třídy
  safelist: {
    standard: [
      ':root','html','body','show','collapse','collapsing','collapsed','fade','active','disabled',
      'in','in-view','reveal-card','scrolled','open','sticky-top','navbar-toggler','navbar-collapse',
      'modal','modal-open','modal-backdrop','offcanvas','tooltip','popover','carousel'
    ],
    greedy: [
      /^col-/, /^row/, /^g[xy]?-/, /^offset/, /^order/, /^ratio/,
      /show$/, /collapsing$/, /^modal/, /^carousel/, /^accordion/, /^dropdown/, /^nav/, /^btn/, /^card/, /^container/
    ]
  }
};
