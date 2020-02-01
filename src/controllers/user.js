import ash from 'express-async-handler';
import { User } from '../db';
import { logger } from '../utils/logger';
import { validateNameAndRes } from '../utils';

// get /user/
export const getUserInfo = ash (async (req, res) => {
  const { sid } = req.decoded;
  logger.api.info ('get /user/ request; sid: %s', sid);

  const user = await User.findOne ({ sso_sid: sid })
    .populate ('groups')
    .populate ('currentGroup')
    .populate ('currentGroup.members')
    .populate ('boards');
  res.json (user);
});

// post /user
export const updateUserInfo = ash (async (req, res) => {
  const { sid } = req.decoded;
  const { username, description } = req.body;
  logger.api.info (
    'post /user/ request; sid: %s, username: %s, description: %s',
    sid,
    username,
    description,
  );
  const updateParams = { description };
  const self = await User.findOne ({ sso_sid: sid });
  if (self.username !== username) {
    const error = await validateNameAndRes (username, req, res);
    if (error) return error;
    updateParams.username = username;
  }
  // Ignore very rare timing issue which is unlikely to happen.
  const updatedUser = await User.findOneAndUpdate ({ sso_sid: sid }, {
    $set: updateParams,
  }, {
    upsert: true,
    new: true,
  })
    .populate ('groups')
    .populate ('currentGroup')
    .populate ('currentGroup.members')
    .populate ('boards');

  return res.json (updatedUser);
});

// post /user/profile
export const updateProfilePhoto = ash (async (req, res) => {
  const { sid } = req.decoded;
  const url = req.file.location;
  logger.api.info ('post /user/profile request; sid: %s, url: %s', sid, url);
  const updatedUser = await User.findOneAndUpdate ({ sso_sid: sid }, {
    $set: {
      profilePhoto: url,
    },
  }, {
    new: true,
  })
    .populate ('groups')
    .populate ('currentGroup')
    .populate ('currentGroup.members')
    .populate ('boards');

  res.json (updatedUser);
});

// post /user/background
export const updateBakPhoto = ash (async (req, res) => {
  const { sid } = req.decoded;
  const url = req.file.location;
  logger.api.info ('post /user/background request; sid: %s, url: %s', sid, url);
  const updatedUser = await User.findOneAndUpdate ({ sso_sid: sid }, {
    $set: {
      backgroundPhoto: url,
    },
  }, {
    new: true,
  })
    .populate ('groups')
    .populate ('currentGroup')
    .populate ('currentGroup.members')
    .populate ('boards');

  res.json (updatedUser);
});

// post /user/currentGroup/:groupId
export const setCurrentGroup = ash (async (req, res) => {
  const { group, self } = req;
  const { sid } = req.decoded;
  logger.api.info ('post /user/currentGroup/:groupId request; sid: %s, groupName: %s', sid, group.name);
  self.currentGroup = group._id;
  await self.save ();
  res.json (group);
});

export const listPins = ash (async (req, res, next) => {
  const { user } = req;
  const { lastSeen } = req.query;
  if (lastSeen) return next ();
  await user
    .populate ({
      path: 'boards',
      populate: {
        path: 'pins',
        populate: {
          path: 'zabo',
          populate: 'owner',
          project: 'name',
        },
      },
      options: {
        sort: { createdAt: -1 },
      },
    })
    .execPopulate ();
  const zabos = user.boards[0].pins.map (pin => pin.zabo);
  let result = zabos;
  const { self } = req;
  if (self) {
    result = zabos.map (zabo => {
      const zaboJSON = zabo.toJSON ();
      const { likes, pins } = zabo;
      return {
        ...zaboJSON,
        isLiked: !!likes.find (like => self._id.equals (like.likedBy)),
        isPinned: !!pins.find (pin => self._id.equals (pin.pinnedBy)),
      };
    });
  }
  return res.send (result); // TODO: Limit and hand it to listNextPins
});

// const { self } = req;
// const { lastSeen } = req.query;
export const listNextPins = ash (async (req, res) => res.send ([])); // TODO
