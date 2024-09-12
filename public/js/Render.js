window.onload = () => autoSize();

function autoSize() {
  $(".auto-size").each(function(i, item) {
    let fontSize = 12;
    const minimumSize = 0.1;
    while (fontSize >= minimumSize && item.scrollHeight > item.clientHeight || item.scrollWidth > item.clientWidth) {
      for (const child of [item, ...item.children]) {
        fontSize = parseFloat(window.getComputedStyle(child, null).getPropertyValue("font-size"), 10);
        fontSize -= 0.1;
        child.style.fontSize = fontSize + "px";
      }
    }
  });
}