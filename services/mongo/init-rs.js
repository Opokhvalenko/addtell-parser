try {
  rs.status();
  print("Replica set already exists");
} catch (e) {
  rs.initiate({
    _id: "rs0",
    members: [{ _id: 0, host: "localhost:27017" }],
  });
  print("Replica set initiated: rs0");
}
