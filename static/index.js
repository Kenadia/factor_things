function main() {
  let $submit = $('.js-submit');

  $submit.click(function () {
    let path = 'go?'
    let params = ['num_groups', 'group', 'max_num', 'user'];
    for (let param of params) {
      path += param + '=' + $('#' + param).val() + '&';
    }
    path = path.slice(0, path.length - 1);
    window.location.href += path;
  });
}
$(document).ready(main);
