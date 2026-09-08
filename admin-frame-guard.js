function protectAdminPageFromFraming() {
  if (window.self === window.top) {
    return;
  }

  document.documentElement.classList.add("admin-framed");

  try {
    window.top.location = window.location.href;
  } catch (error) {
    console.warn("Blocked an attempt to frame an admin page.", error);
  }
} // End of protectAdminPageFromFraming

protectAdminPageFromFraming();
