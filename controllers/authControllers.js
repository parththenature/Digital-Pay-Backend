const db = require("../config/mysql");

db.query("SELECT * FROM users", (err, results) => {
  if (err) throw err;
  console.log(results);
});
