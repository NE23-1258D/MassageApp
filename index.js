const express = require('express');
const Sequelize = require('sequelize');

let DB_INFO = "postgres://messageapp:TheFirstTest@postgres:5432/messageapp";
let pg_option = {};

if (process.env.DATABASE_URL) {
  DB_INFO = process.env.DATABASE_URL;
  pg_option = { ssl: { rejectUnauthorized: false } };
}

const sequelize = new Sequelize(DB_INFO, {
  dialect: 'postgres',
  dialectOptions: pg_option,
});

const PORT = 8080;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use("/public", express.static(__dirname + "/public"));

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
  }
  catch (mes) {
    console.log('Unable to connect to the database:', mes);
  }
})();

const Messages = sequelize.define('messages', {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
  message: Sequelize.TEXT
},
  {
    // timestamps: false,        // disable the default timestamps
    freezeTableName: true     // stick to the table name we define
  }
);


(async () => {
  try {
    await sequelize.sync({ force: false, alter: true });
    setupRoute(); // データベース同期後にルートを設定
    console.log("Database synchronized successfully.");
  } catch (error) {
    console.error("Error synchronizing the database:", error);
  }
})();

let lastMessage = ""; // lastMessageはletで宣言

function setupRoute() {
  console.log("db connection succeeded");

  // トップページルート
  app.get('/', (req, res) => {
    res.render('top.ejs');
  });

  // メッセージ追加ページルート (GET)
  app.get('/add', (req, res) => {
    res.render('add.ejs', { lastMessage: lastMessage });
  });

  // メッセージ追加処理ルート (POST)
  app.post('/add', async (req, res) => {
    let newMessage = new Messages({
      message: req.body.text
    });
    try {
      await newMessage.save();
      lastMessage = req.body.text;
      res.render('add.ejs', { lastMessage: lastMessage });
    } catch (error) {
      console.error("Error adding message:", error); // エラーログを追加
      res.status(500).send("エラーが発生しました: メッセージを追加できませんでした"); // ステータスコードとメッセージを明確に
    }
  });

  // 全メッセージ表示ルート
  app.get('/view', async (req, res) => {
    try {
      const result = await Messages.findAll(); // const を使用
      console.log(result);
      const allMessages = result.map((e) => { // const を使用
        return e.message + " (" + e.createdAt.toLocaleString() + ")"; // 日付の表示を改善
      });
      res.render('view.ejs', { messages: allMessages });
    } catch (error) {
      console.error("Error viewing messages:", error); // エラーログを追加
      res.status(500).send("エラーが発生しました: メッセージを表示できませんでした");
    }
  });

  // **** 検索ルートの定義をここsetupRoute()関数内に追加/移動 ****

  // 検索フォーム表示ルート (GET)
  app.get('/search', (req, res) => {
    res.render('search.ejs', { results: [], searchKeyword: '' }); // 検索キーワードを初期値として追加
  });

  // 検索処理ルート (POST)
  app.post('/search', async (req, res) => {
    const Op = Sequelize.Op;
    const searchText = req.body.searchText || ''; // searchTextが存在しない場合の対策
    let searchResults = [];

    try {
      // 検索キーワードが空でなければ検索を実行
      if (searchText.trim() !== '') {
        const result = await Messages.findAll({
          where: {
            message: {
              [Op.regexp]: searchText // 正規表現検索
            }
          }
        });
        searchResults = result.map((e) => {
          return e.message + " (" + e.createdAt.toLocaleString() + ")"; // 日付の表示を改善
        });
      }

      // 検索結果と入力されたキーワードをレンダリング
      res.render('search.ejs', { results: searchResults, searchKeyword: searchText });
    }
    catch (error) {
      console.error("Error during search:", error);
      // エラー発生時も search.ejs をレンダリングし、エラーメッセージを表示
      res.render('search.ejs', { results: [], searchKeyword: searchText, error: "検索中にエラーが発生しました。" });
    }
  });

  // **** 検索ルートの定義はここまで ****

} // setupRoute() 関数の終わり


// アプリケーションがポートをリッスンし始める
// setupRoute()関数が呼び出された後に、app.listen()が実行されるようにする
app.listen(process.env.PORT || PORT, () => {
  console.log(`Server is listening on http://localhost:${process.env.PORT || PORT}`);
});
