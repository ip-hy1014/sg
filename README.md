# SG 学習アプリ

情報セキュリティマネジメント試験（SG）の学習アプリです。

## 構成

- `index.html` → `src/gate.js`（PBKDF2-SHA256 12万回 + AES-256-GCM で復号）→ `src/vault.js` → `src/main.js`
- 学習データは暗号化して `src/vault.js` に入れています。平文の4ファイルは `.gitignore` 済みです。

## 暗号化

データを編集したら、必ず再暗号化してから commit します。

```
cd ~/sg && SG_PASSWORD='パスワード' node scripts/encrypt-vault.js
```

vault に入るのは次の4ファイルです。

1. `src/questions.js` — 設定（EXAM・AREA_WEIGHT・PHASES）と問題
2. `src/questions-b.js` — 科目Bの事例問題
3. `src/questions-extra.js` — 追加問題
4. `論点.html` — 論点整理

## 検証

AES-GCM は平文と暗号文の長さが一致します。長さを比べれば、現在の4ファイルが入っているか確認できます。
