const express = require("express");
const app = express();
app.use(express.static("public"));
const bodyParser = require("body-parser");
const { UPDATE } = require("mongodb/lib/bulk/common");
app.use(bodyParser.urlencoded({ extended: true }));
const methodOverride = require("method-override");
app.use(methodOverride("_method"));
// Socket.io
const http = require("http").createServer(app);
const { Server, Socket } = require("socket.io");
const io = new Server(http);

const MongoClient = require("mongodb").MongoClient;
app.set("view engine", "ejs");

const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
require("dotenv").config();

app.use(
  session({ secret: "비밀코드", resave: true, saveUninitialized: false })
);
app.use(passport.initialize());
app.use(passport.session());

var db; // 환경변수 설정
MongoClient.connect(process.env.DB_URL, function (에러, client) {
  if (에러) {
    console.error("MongoDB 연결 에러:", 에러);
    process.exit(1); // 서버 종료 또는 다른 조치를 취할 수 있음
  }
  db = client.db("with");
  http.listen(8080, function () {
    console.log("listening 8080");
  });
});

//로그인페이지
app.get("/login", function (요청, 응답) {
  응답.render("login.ejs");
});

app.post(
  "/login",
  passport.authenticate("local", { failureRedirect: "/fail" }),
  function (요청, 응답) {
    // 인증에 성공했을 때 처리
    응답.redirect("/");
  }
);

app.get("/fail", function (요청, 응답) {
  응답.render("fail.ejs");
});

// //회원가입시 데이터 저장
app.get("/sign-up", function (요청, 응답) {
  응답.render("sign-up.ejs");
});

//가입시 정보 저장
//add는 form action으로 지정한거
app.post("/add", function (요청, 응답) {
  db.collection("user").insertOne(
    {
      이름: 요청.body.user_name,
      메일: 요청.body.user_email,
      비밀번호: 요청.body.user_password,
      유형: 요청.body.user_type,
    },
    function (에러, 결과) {
      if (에러) {
        console.error("데이터베이스 삽입 에러:", 에러);
        응답.status(500).send("서버 오류");
      } else {
        console.log("저장완료");
        응답.send("전송완료");
      }
    }
  );
});

//로그인에 필요함 (로컬스트레티지 인증방식)
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "pw",
      session: true,
      passReqToCallback: false,
    },
    function (입력한아이디, 입력한비번, done) {
      db.collection("user").findOne(
        { 메일: 입력한아이디 },
        function (에러, 결과) {
          if (에러) return done(에러);

          if (!결과)
            return done(null, false, { message: "존재하지않는 아이디입니다" });
          if (입력한비번 == 결과.비밀번호) {
            return done(null, 결과);
          } else {
            return done(null, false, { message: "비번가 틀렸습니다." });
          }
        }
      );
    }
  )
);

//세션 만들기
passport.serializeUser(function (user, done) {
  done(null, user.메일);
});
//마이페이지 만들때
passport.deserializeUser(function (아이디, done) {
  db.collection("user").findOne({ 메일: 아이디 }, function (에러, 결과) {
    done(null, 결과);
  });
});

//마이페이지로 요청을했을때 미들함수 저 로그인했니를 거치면
app.get("/", 로그인했니, function (요청, 응답) {
  db.collection("post")
    .find()
    .toArray(function (에러, 결과) {
      console.log(결과);
      응답.render("index.ejs", { posts: 결과, 사용자: 요청.user });
    });
});

//예외처리
function 로그인했니(요청, 응답, next) {
  if (요청.user) {
    next();
  } else {
    응답.status(401).send("로그인을 해주세요"); // 로그인되지 않은 경우 401 상태코드 반환
  }
}

//채팅방 리스트
app.get("/list", 로그인했니, function (요청, 응답) {
  db.collection("post")
    .find()
    .toArray(function (에러, 결과) {
      console.log(결과);
      응답.render("list.ejs", { posts: 결과, 사용자: 요청.user });
    });
});

//채팅방 생성
app.get("/write", 로그인했니, function (요청, 응답) {
  응답.render("write.ejs", { 사용자: 요청.user });
});

app.post("/add-write", 로그인했니, function (요청, 응답) {
  db.collection("counter").findOne(
    { name: "게시물갯수" },
    function (에러, 결과) {
      var 총게시물갯수 = 결과.totalPost;
      db.collection("post").insertOne(
        {
          _id: 총게시물갯수 + 1,
          출발지: 요청.body.start,
          도착지: 요청.body.end,
          날짜: 요청.body.date,
          시간: 요청.body.time,
          모집인원: 요청.body.num,
          작성자: 요청.user._id,
          작성자이름: 요청.user.이름,
          승객현황: 요청.body.passenger,
          기사현황: 요청.body.driver,
        },
        function (에러, 결과) {
          console.log("저장완료");
          db.collection("counter").updateOne(
            { name: "게시물갯수" },
            { $inc: { totalPost: 1 } },
            function (에러, 결과) {
              console.log("게시물 등록 완료");
              응답.redirect("/list");
            }
          );
        }
      );
    }
  );
});

//채팅방 삭제
app.delete("/delete", function (요청, 응답) {
  console.log(요청.body);
  요청.body._id = parseInt(요청.body._id);
  var 삭제할데이터 = { _id: 요청.body._id, 작성자: 요청.user._id };
  db.collection("post").deleteOne(삭제할데이터, function (에러, 결과) {
    if (에러) {
      console.log(에러);
    }
    console.log("삭제완료");
    응답.status(200).send({ message: "삭제 성공" });
  });
});

//수정페이지
app.get("/edit/:id", function (요청, 응답) {
  db.collection("post").findOne(
    { _id: parseInt(요청.params.id) },
    function (에러, 결과) {
      console.log(결과);
      응답.render("edit.ejs", { post: 결과, 사용자: 요청.user });
    }
  );
});

app.put("/edit", function (요청, 응답) {
  var 수정할데이터 = { _id: parseInt(요청.body.id), 작성자: 요청.user._id };
  db.collection("post").updateOne(
    수정할데이터,
    {
      $set: {
        출발지: 요청.body.start,
        도착지: 요청.body.end,
        날짜: 요청.body.date,
        시간: 요청.body.time,
        모집인원: 요청.body.num,
        승객현황: 요청.body.passenger,
        기사현황: 요청.body.driver,
      },
    },
    function (에러, 결과) {
      console.log("수정완료");
      응답.redirect("/list");
    }
  );
});

//검색기능
app.get("/search", function (요청, 응답) {
  var 검색조건 = [
    {
      $search: {
        index: "titleSearch",
        text: {
          query: 요청.query.value,
          path: ["출발지", "도착지"], // 제목날짜 둘다 찾고 싶으면 ['제목', '날짜']
        },
      },
    },
    { $sort: { _id: 1 } },
  ];
  db.collection("post")
    .aggregate(검색조건)
    .toArray(function (에러, 결과) {
      console.log(결과);
      응답.render("search.ejs", { posts: 결과, 사용자: 요청.user });
    });
});

//채팅페이지
app.get("/chat/:id", 로그인했니, function (요청, 응답) {
  db.collection("post").findOne(
    { _id: parseInt(요청.params.id) },
    function (에러, 결과) {
      console.log(결과);
      응답.render("chat.ejs", { data: 결과, 사용자: 요청.user, posts: 요청 });
    }
  );
});

io.on("connection", function (socket) {
  console.log("유저 접속됨");

  socket.on("room-send", function (data) {
    // 게시글 고유의 방에 있는 모든 클라이언트에게 메시지 전송
    io.to(data.room).emit("broadcast", data);
  });

  socket.on("joinroom", function (data) {
    // 클라이언트를 게시글 고유의 방에 조인
    socket.join(data.room);
  });
});
