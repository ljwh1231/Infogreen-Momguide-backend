# Infogreen-Momguide-backend

# Prerequisites

- npm
- mysql

# 개발

## 초기 셋팅

설정파일을 작성해줍니다.

```
cp config/config.js.example config/config.js
vim config/config.js
```

aws-sdk 사용을 위한 세팅을 해줍니다.
```
vim ~/.aws/credentials
```
https://docs.aws.amazon.com/ko_kr/sdk-for-java/v1/developer-guide/setup-credentials.html

필요한 라이브러리를 설치합니다.

```
npm install
```

## 실행

```
node server.js
```

