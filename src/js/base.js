
(function() {
    if (window.matchMedia && window.matchMedia("(max-width: 390px)").matches)
        document.write("<meta  name='viewport'  content='width=390'>");
})();

angular.element(document).ready(function() {
    FastClick.attach(document.body);
});
