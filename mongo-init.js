(function () {
  try {
    rs.status();
    print("replica set already initiated");
    return;
  } catch (_) {
    print("replica set not initiated, initiating...");
  }

  rs.initiate({
    _id: "rs0",
    members: [{ _id: 0, host: "mongo:27017" }],
  });

  var tries = 25;
  while (tries-- > 0) {
    try {
      var st = rs.status();
      if (
        st.ok === 1 &&
        st.members &&
        st.members.some(function (m) {
          return m.stateStr === "PRIMARY";
        })
      ) {
        print("replica set is PRIMARY");
        break;
      }
    } catch (e) {}
    sleep(1000);
  }
})();
