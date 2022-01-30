'use strict';
const { parse } = require('@babel/core');
const express = require('express');
const { DataTypes } = require('sequelize');
const uuid = require('uuid');
const Bookmark = require('../models/bookmark');
const User = require('../models/user');

const router = express.Router();
const authenticationEnsurer = require('./authentication-ensurer');  // 認証を確かめるハンドラ関数


router.get('/new', authenticationEnsurer, (req, res, next) => {
  res.render('new', { user: req.user });  // new.pugの表示
});


router.post('/', authenticationEnsurer, (req, res, next) => {
  console.log(req.body);  // debug:確認用コンソール表示
  const bookmarkId = uuid.v4();   // uuid(ランダム16進数文字列)を設定
  const updatedAt = new Date();
  // 取得したブックマーク情報をデータベースに保存
  Bookmark.create({
    bookmarkId: bookmarkId,
    bookmarkName: req.body.bookmarkName.slice(0, 255) || '(名称未設定)',
    bookmarkURL: req.body.bookmarkURL,
    // tag:
    memo: req.body.memo,
    createdBy: req.user.id,
    updatedAt: updatedAt
  }).then((bookmark) => {
    // TODO:連動しているパラメータがあれば記載

    // /bookmarks/:bookmarksId にリダイレクトリダイレクト
    res.redirect('/bookmarks/' + bookmark.bookmarkId);
  });
});


router.get('/:bookmarkId', authenticationEnsurer, (req, res, next) => {
  Bookmark.findOne({
    include: [
      {
        model: User,
        attributes: ['userId', 'username']
      }
    ],
    where: {
      bookmarkId: req.params.bookmarkId
    },
    order: [['updatedAt', 'DESC']]
  }).then((bookmark) => {
    if (bookmark) {
      res.render('bookmark', {
        user: req.user,
        bookmark: bookmark,
        users: [req.user]
      });
    } else {
      const err = new Error('指定されたブックマークは見つかりません');
      err.status = 404;
      next(err);
    }
  });
});


router.get('/:bookmarkId/edit', authenticationEnsurer, (req, res, next) => {
  Bookmark.findOne({
    where: {
      bookmarkId: req.params.bookmarkId
    }
  }).then((bookmark) => {
    if (isMine(req, bookmark)) {  // 作成者のみが編集フォームを開ける(作成者がログインユーザと一致することを確認)
      res.render('edit', {
        user: req.user,
        bookmark: bookmark
      });
    } else {
      const err = new Error('指定されたブックマークがない、または、編集する権限がありません');
      err.status = 404;
      next(err);
    }
  });
});


router.post('/:bookmarkId/', authenticationEnsurer, (req, res, next) => {
  console.log(`/:bookmarkId/edit?edit===1 を実行`);
  Bookmark.findOne({
    where: {
      bookmarkId: req.params.bookmarkId
    }
  }).then((bookmark) => {
    if (bookmark && isMine(req, bookmark)) {  // bookmarkが存在していて、作成者がログインユーザと一致することを確認
      if (parseInt(req.query.edit) === 1) {
        console.log('データベースの更新');
        const updatedAt = new Date();
        // データベースのデータを更新する
        bookmark.update({
          bookmarkId: bookmark.bookmarkId,  // TODO：不要?
          bookmarkName: req.body.bookmarkName,
          bookmarkURL: req.body.bookmarkURL,
          // tag:
          memo: req.body.memo,
          createdBy: req.user.id,
          updatedAt: updatedAt
        }).then((bookmark) => {
          // TODO:追加されているかチェック 不要？
          // リダイレクト
          console.log('データベースの更新完了');
          res.redirect('/');
        });
      } else {
        const err = new Error('不正なリクエストです');
        err.status = 400;
        next(err);
      }
    } else {
      const err = new Error('指定されたブックマークがない、または、編集する権限がありません');
      err.status = 404;
      next(err);
    }
  });
});


/**
 * 指定されたブックマークの作成者がログインユーザと一致していることを確認する
 * @param {*} req 
 * @param {*} bookmark 
 * @returns ture, false
 */
function isMine(req, bookmark) {
  return bookmark && parseInt(bookmark.createdBy) === parseInt(req.user.id);
}


module.exports = router;