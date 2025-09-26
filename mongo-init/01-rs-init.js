try {
  const status = rs.status();
  if (status.ok === 1) {
    print("replica set already initiated:", status.set);
  }
} catch (e) {
  print("replica set not initiated, initiating...");
  rs.initiate({
    _id: "rs0",
    members: [{ _id: 0, host: "mongo:27017" }],
  });

  let attempts = 0;
  while (attempts < 60) {
    try {
      const st = rs.status();
      if (st.members && st.members.some((m) => m.stateStr === "PRIMARY")) {
        print("replica set is PRIMARY");
        break;
      }
    } catch (_) {}
    sleep(1000);
    attempts++;
  }
}
