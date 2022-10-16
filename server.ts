import { PrismaClient } from "@prisma/client/";
const prisma = new PrismaClient();

import * as dotenv from "dotenv";
dotenv.config();

import * as tmi from "tmi.js";

const client = new tmi.Client({
  options: { debug: true },
  identity: {
    username: process.env.TWITCH_USERNAME,
    password: process.env.TWITCH_USER_AUTH,
  },
  channels: [process.env.TWITCH_USERNAME || ""],
});

const number2level = (number: number) => {
  switch (number) {
    case 0:
      return "Viewer";
    case 1:
      return "Subscriber";
    case 2:
      return "VIP";
    case 3:
      return "Moderator";
    default:
      break;
  }
};

const level2number = (level: string) => {
  if (level === undefined) return undefined;
  switch (level.toLowerCase()) {
    case "viewer":
      return 0;
    case "subscriber":
      return 1;
    case "vip":
      return 2;
    case "moderator":
      return 3;
    case "v":
      return 0;
    case "s":
      return 1;
    case "m":
      return 3;
    default:
      return -1;
  }
};

const joinchannels = async (channels: any) => {
  if (!channels?.length) return;
  setTimeout(async () => {
    await client
      .join(channels[0].broadcasterName)
      .catch((err) => console.log(err));

    console.log(`Joined ${channels[0].broadcasterName}`);

    channels.shift();

    if (!channels?.length) return;

    joinchannels(channels);
  }, 1000);
};

const joinInit = async () => {
  const channels = await prisma.queue.findMany().catch((err) => {
    console.log(err);
    return;
  });

  joinchannels(channels);
};

joinInit();

const userLevel = (tags: any) => {
  if (tags["user-id"] === tags["room-id"]) return 3;
  if (tags["mod"]) return 3;
  if (tags["vip"]) return 2;
  if (tags["subscriber"]) return 1;
  return 0;
};

const joinchannel = async (channel: string, tags: any, message: string) => {
  if (tags["room-id"] !== process.env.TWITCH_CHANNEL_ID) return;

  const user_id = tags["user-id"];
  const user_name = tags["display-name"];

  if (!user_id || !user_name) return;

  const user = await prisma.queue
    .findUnique({
      where: {
        id: user_id,
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (user) {
    client.say(channel, `@${user_name}, I am already in your channel.`);
    return;
  }

  const queue = await prisma.queue
    .create({
      data: {
        id: user_id,
        broadcasterName: user_name,
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!queue) {
    client.say(channel, `@${user_name}, Failed to join your channel.`);
    return;
  }

  await client.join(user_name).catch((err) => {
    client.say(channel, `@${user_name}, Failed to join your channel.`);
    console.log(err);
    return;
  });

  client.say(channel, `@${user_name}, I have joined your channel.`);
};

const leavechannel = async (channel: string, tags: any, message: string) => {
  if (tags["room-id"] !== process.env.TWITCH_CHANNEL_ID) return;

  const user_id = tags["user-id"];
  const user_name = tags["display-name"];

  if (!user_id || !user_name) return;

  const user = await prisma.queue
    .findUnique({
      where: {
        id: user_id,
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!user) {
    client.say(channel, `@${user_name}, I am not in your channel.`);
    return;
  }

  const queue = await prisma.queue
    .delete({
      where: {
        id: user_id,
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!queue) {
    client.say(channel, `@${user_name}, Failed to leave your channel.`);
    return;
  }

  await client.part(user_name).catch((err) => {
    client.say(channel, `@${user_name}, Failed to leave your channel.`);
    console.log(err);
    return;
  });

  client.say(channel, `@${user_name}, I have left your channel.`);
};

const manualJoin = async (channel: string, tags: any, message: string) => {
  if (tags["room-id"] !== process.env.TWITCH_CHANNEL_ID) return;

  const user_id = tags["user-id"];
  const user_name = tags["display-name"];

  if (user_id !== process.env.TWITCH_OWNER_ID) {
    client.say(
      channel,
      `@${user_name}, You do not have permission to use this command.`
    );
    return;
  }

  if (!user_id || !user_name) return;

  const adduser = message.split(" ")[1].replace("@", "");
  const adduserID = message.split(" ")[2];

  if (!adduser || !adduserID) {
    client.say(
      channel,
      `@${user_name}, Please provide a username and user ID.`
    );
    return;
  }

  const user = await prisma.queue
    .findUnique({
      where: {
        id: adduserID,
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (user) {
    client.say(channel, `@${user_name}, I am already in ${adduser}'s channel.`);
    return;
  }

  const queue = await prisma.queue
    .create({
      data: {
        id: adduserID,
        broadcasterName: adduser,
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!queue) {
    client.say(channel, `@${user_name}, Failed to join ${adduser}'s channel.`);
    return;
  }

  await client.join(adduser).catch((err) => {
    client.say(channel, `@${user_name}, Failed to join ${adduser}'s channel.`);
    console.log(err);
    return;
  });

  client.say(channel, `@${user_name}, I have joined ${adduser}'s channel.`);
};

const help = async (channel: string, tags: any, message: string) => {
  if (tags["room-id"] !== process.env.TWITCH_CHANNEL_ID) return;

  const user_name = tags["display-name"];

  if (!user_name) return;

  client.say(
    channel,
    `@${user_name}, Commands: !joinchannel, !leavechannel, !manualjoin [username] [userID], !help`
  );
};

const queue = async (channel: string, tags: any, message: string) => {
  const channelID = tags["room-id"];

  const user_name = tags["display-name"];

  if (!user_name) return;

  const queue = await prisma.queue
    .findUnique({
      where: {
        id: channelID,
      },
      include: {
        User: true,
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!queue) {
    client.say(
      channel,
      `@${user_name}, could not find a queue for this channel.`
    );
    return;
  }

  const queueOpen = queue.queueOpen;

  if (!queueOpen) {
    client.say(channel, `@${user_name}, the queue is currently closed.`);
    return;
  }

  const queueLimit = queue.queueLength;
  const queueLevel = queue.queueLevel;

  const queueLength = queue.User.length;

  if (queueLimit === 0) {
    client.say(
      channel,
      `@${user_name}, the queue is currently open. There are ${queueLength} users in the queue. There is no user limit and is open for ${number2level(
        queueLevel
      )}s. Use !join to join the queue.`
    );
    return;
  }

  if (queueLimit === queueLength) {
    client.say(
      channel,
      `@${user_name}, the queue is currently open however it is FULL. There are ${queueLength} users in the queue. Use !join to join the queue when users are removed.`
    );
    return;
  }

  client.say(
    channel,
    `@${user_name}, the queue is currently open. There are ${queueLength} users in the queue. The queue is currently at ${queueLength}/${queueLimit} and is open for ${number2level(
      queueLevel
    )}. Use !join to join the queue.`
  );
};

const join = async (channel: string, tags: any, message: string) => {
  const channelID = tags["room-id"];

  const user_name = tags["display-name"];

  if (!user_name) return;

  const queue = await prisma.queue
    .findUnique({
      where: {
        id: channelID,
      },
      include: {
        User: true,
        Blacklist: true,
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!queue) {
    client.say(
      channel,
      `@${user_name}, could not find a queue for this channel.`
    );
    return;
  }

  if (queue.User.find((user) => user.Name === user_name)) {
    client.say(channel, `@${user_name}, you are already in the queue.`);
    return;
  }

  const queueOpen = queue.queueOpen;
  const queueLevel = queue.queueLevel;
  const queueLimit = queue.queueLength;
  const queueLength = queue.User.length;
  const queueBanned = queue.Blacklist.map((user) => user.Name.toLowerCase());

  if (queueBanned.includes(user_name.toLowerCase())) {
    client.say(
      channel,
      `@${user_name}, you are banned from joining the queue.`
    );
    return;
  }

  if (!queueOpen) {
    client.say(channel, `@${user_name}, the queue is currently closed.`);
    return;
  }

  if (queueLimit === queueLength && queueLimit !== 0) {
    client.say(channel, `@${user_name}, the queue is currently FULL.`);
    return;
  }

  if (userLevel(tags) < queueLevel) {
    client.say(
      channel,
      `@${user_name}, you must be at least ${number2level(
        queueLevel
      )} to join this queue.`
    );
    return;
  }

  const user = await prisma.queue
    .update({
      where: {
        id: channelID,
      },
      data: {
        User: {
          create: {
            Name: user_name,
          },
        },
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!user) {
    client.say(channel, `@${user_name}, failed to join the queue.`);
    return;
  }

  client.say(channel, `@${user_name}, you have joined the queue.`);
};

const leave = async (channel: string, tags: any, message: string) => {
  const channelID = tags["room-id"];

  const user_name = tags["display-name"];

  if (!user_name) return;

  const queue = await prisma.queue
    .findUnique({
      where: {
        id: channelID,
      },
      include: {
        User: true,
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!queue) {
    client.say(
      channel,
      `@${user_name}, could not find a queue for this channel.`
    );
    return;
  }

  if (
    !queue.User.some(
      (user) => user.Name.toLowerCase() === user_name.toLowerCase()
    )
  ) {
    client.say(channel, `@${user_name}, you are not in the queue.`);
    return;
  }

  await prisma.user
    .deleteMany({
      where: {
        AND: [
          {
            Name: user_name,
          },
          {
            queueId: channelID,
          },
        ],
      },
    })
    .catch((err) => {
      client.say(channel, `@${user_name}, failed to leave the queue.`);
      console.log(err);
      return;
    });

  client.say(channel, `@${user_name}, you have left the queue.`);
};

const openQueue = async (channel: string, tags: any, message: string) => {
  const channelID = tags["room-id"];

  const user_name = tags["display-name"];
  if (!user_name) return;

  if (userLevel(tags) < 3) {
    client.say(
      channel,
      `@${user_name}, you must be at least a mod to open the queue.`
    );
    return;
  }
  const queueLevel = message.split(" ")[1];
  const queueLimit = message.split(" ")[2];

  const convertedLevel = level2number(queueLevel);
  const convertedLimit = parseInt(queueLimit);

  if (convertedLevel === -1) {
    client.say(
      channel,
      `@${user_name}, invalid queue level. Please use [Viewer, Follower, Subscriber, VIP or Moderator]`
    );
    return;
  }

  if (parseInt(queueLimit) === NaN) {
    client.say(
      channel,
      `@${user_name}, invalid queue limit. Please use a number.`
    );
    return;
  }

  const queue = await prisma.queue
    .findUnique({
      where: {
        id: channelID,
      },
      include: {
        User: true,
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!queue) {
    client.say(channel, `@${user_name}, failed to open the queue.`);
    return;
  }

  if (queue.queueOpen) {
    client.say(channel, `@${user_name}, the queue is already open.`);
    return;
  }

  if (queueLevel === undefined && queueLimit === undefined) {
    const newQueue = await prisma.queue
      .update({
        where: {
          id: channelID,
        },
        data: {
          queueOpen: true,
        },
      })
      .catch((err) => {
        console.log(err);
        return;
      });

    if (!newQueue) {
      client.say(channel, `@${user_name}, failed to open the queue.`);
      return;
    }

    if (queue.queueLength === 0) {
      return client.say(
        channel,
        `@${user_name}, the queue is now open for ${number2level(
          queue.queueLevel
        )}s. There is no user limit.`
      );
    }
    return client.say(
      channel,
      `@${user_name}, the queue is now open for ${number2level(
        queue.queueLevel
      )}s. The queue is currently at ${queue.User.length}/${queue.queueLength}.`
    );
  }

  if (
    queue.queueLength === convertedLimit &&
    queue.queueLevel === convertedLevel
  ) {
    const newQueue = await prisma.queue
      .update({
        where: {
          id: channelID,
        },
        data: {
          queueOpen: true,
        },
      })
      .catch((err) => {
        console.log(err);
        return;
      });

    if (!newQueue) {
      client.say(channel, `@${user_name}, failed to open the queue.`);
      return;
    }

    if (queue.queueLength === 0) {
      return client.say(
        channel,
        `@${user_name}, the queue is now open for ${number2level(
          queue.queueLevel
        )}s. There is no user limit.`
      );
    }
    return client.say(
      channel,
      `@${user_name}, the queue is now open for ${number2level(
        queue.queueLevel
      )}s. The queue is currently at ${queue.User.length}/${queue.queueLength}.`
    );
  }

  const updatedQueue = await prisma.queue
    .update({
      where: {
        id: channelID,
      },
      data: {
        queueOpen: true,
        queueLevel: convertedLevel || queue.queueLevel,
        queueLength: convertedLimit || queue.queueLength,
      },
      include: {
        User: true,
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!updatedQueue) {
    client.say(channel, `@${user_name}, failed to open the queue.`);
    return;
  }

  if (updatedQueue.queueLength === 0) {
    return client.say(
      channel,
      `@${user_name}, the queue is now open for ${number2level(
        updatedQueue.queueLevel
      )}s. There is no user limit.`
    );
  }

  client.say(
    channel,
    `@${user_name}, the queue is now open for ${number2level(
      updatedQueue.queueLevel
    )}s. The queue is currently at ${updatedQueue.User.length}/${
      updatedQueue.queueLength
    }.`
  );
};

const closeQueue = async (channel: string, tags: any, message: string) => {
  const channelID = tags["room-id"];

  const user_name = tags["display-name"];

  if (!user_name) return;

  if (userLevel(tags) < 3) {
    client.say(
      channel,
      `@${user_name}, you must be at least a mod to close the queue.`
    );
    return;
  }

  const queue = await prisma.queue
    .findUnique({
      where: {
        id: channelID,
      },
      include: {
        User: true,
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!queue) {
    client.say(channel, `@${user_name}, failed to close the queue.`);
    return;
  }

  if (!queue.queueOpen) {
    client.say(channel, `@${user_name}, the queue is already closed.`);
    return;
  }

  const newQueue = await prisma.queue
    .update({
      where: {
        id: channelID,
      },
      data: {
        queueOpen: false,
      },
    })
    .catch((err) => {
      client.say(channel, `@${user_name}, failed to close the queue.`);
      console.log(err);
      return;
    });

  if (!newQueue) {
    client.say(channel, `@${user_name}, failed to close the queue.`);
    return;
  }

  client.say(channel, `@${user_name}, the queue is now closed.`);
};

const clearQueue = async (channel: string, tags: any, message: string) => {
  const channelID = tags["room-id"];

  const user_name = tags["display-name"];

  if (!user_name) return;

  if (userLevel(tags) < 3) {
    client.say(
      channel,
      `@${user_name}, you must be at least a mod to clear the queue.`
    );
    return;
  }

  const queue = await prisma.queue
    .findUnique({
      where: {
        id: channelID,
      },
      include: {
        User: true,
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!queue) {
    client.say(channel, `@${user_name}, failed to clear the queue.`);
    return;
  }

  if (queue.User.length === 0) {
    client.say(channel, `@${user_name}, the queue is already empty.`);
    return;
  }

  const newQueue = await prisma.queue
    .update({
      where: {
        id: channelID,
      },
      data: {
        User: {
          deleteMany: {},
        },
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!newQueue) {
    client.say(channel, `@${user_name}, failed to clear the queue.`);
    return;
  }

  client.say(channel, `@${user_name}, the queue has been cleared.`);
};

const queueLength = async (channel: string, tags: any, message: string) => {
  const channelID = tags["room-id"];

  const user_name = tags["display-name"];

  if (!user_name) return;

  const queue = await prisma.queue
    .findUnique({
      where: {
        id: channelID,
      },
      include: {
        User: true,
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!queue) {
    client.say(channel, `@${user_name}, failed to get the queue length.`);
    return;
  }

  if (queue.queueLength === 1) {
    return client.say(
      channel,
      `@${user_name}, there is ${queue.User.length} users in the queue.`
    );
  }

  return client.say(
    channel,
    `@${user_name}, there are ${queue.User.length} users in the queue.`
  );
};

const limit = async (channel: string, tags: any, message: string) => {
  const channelID = tags["room-id"];

  const user_name = tags["display-name"];

  const queueLimit = message.split(" ")[1];

  if (!user_name) return;

  if (userLevel(tags) < 3) {
    client.say(
      channel,
      `@${user_name}, you must be at least a mod to set the queue length.`
    );
    return;
  }
  const queue = await prisma.queue
    .findUnique({
      where: {
        id: channelID,
      },
      include: {
        User: true,
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!queue) {
    client.say(channel, `@${user_name}, failed to get the queue length.`);
    return;
  }

  if (!queueLimit) {
    return client.say(
      channel,
      `@${user_name}, you must specify a queue limit. (!limit <number>)`
    );
  }

  const convertedLimit = parseInt(queueLimit);

  if (isNaN(convertedLimit)) {
    client.say(channel, `@${user_name}, the queue limit must be a number.`);
    return;
  }

  if (convertedLimit < 0) {
    client.say(channel, `@${user_name}, the queue limit cannot be negative.`);
    return;
  }

  const newQueue = await prisma.queue
    .update({
      where: {
        id: channelID,
      },
      data: {
        queueLength: convertedLimit,
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!newQueue) {
    client.say(channel, `@${user_name}, failed to set the queue length.`);
    return;
  }

  if (newQueue.queueLength === 0) {
    return client.say(
      channel,
      `@${user_name}, the queue limit has been removed.`
    );
  }

  client.say(
    channel,
    `@${user_name}, the queue limit has been set to ${newQueue.queueLength}.`
  );
};

const queueLevel = async (channel: string, tags: any, message: string) => {
  const channelID = tags["room-id"];

  const user_name = tags["display-name"];

  const setLevel = message.split(" ")[1];

  const convertedLevel = level2number(setLevel);

  if (!user_name) return;

  const queue = await prisma.queue
    .findUnique({
      where: {
        id: channelID,
      },
      include: {
        User: true,
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!queue) {
    client.say(channel, `@${user_name}, failed to get the queue level.`);
    return;
  }

  if (!setLevel) {
    return client.say(
      channel,
      `@${user_name}, the queue is for ${number2level(queue.queueLevel)}s.`
    );
  }

  if (userLevel(tags) < 3) {
    client.say(
      channel,
      `@${user_name}, you must be at least a mod to change the queue level.`
    );
    return;
  }

  if (convertedLevel===-1) {
    client.say(channel, `@${user_name}, please use a valid level.`);
    return;
  }

  const updatedQueue = await prisma.queue
    .update({
      where: {
        id: channelID,
      },
      data: {
        queueLevel: convertedLevel,
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!updatedQueue) {
    client.say(channel, `@${user_name}, failed to set the queue level.`);
    return;
  }

  client.say(
    channel,
    `@${user_name}, the queue is now for ${number2level(
      updatedQueue.queueLevel
    )}s.`
  );
};

const list = async (channel: string, tags: any, message: string) => {
  const channelID = tags["room-id"];

  const user_name = tags["display-name"];

  if (!user_name) return;

  const queue = await prisma.queue
    .findUnique({
      where: {
        id: channelID,
      },
      include: {
        User: true,
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!queue) {
    client.say(channel, `@${user_name}, failed to get the queue list.`);
    return;
  }

  if (queue.User.length === 0) {
    client.say(channel, `@${user_name}, the queue is empty.`);
    return;
  }

  let list = `@${user_name}, the queue is: `;
  const users: string[] = [];
  for (let i = 0; i < queue.User.length; i++) {
    users.push(`${i + 1}. ${queue.User[i].Name}`);
  }

  list = list + users.join(", ");

  client.say(channel, list);
};

const pick = async (channel: string, tags: any, message: string) => {
  const channelID = tags["room-id"];

  const user_name = tags["display-name"];

  let amount: string | number = message.split(" ")[1];

  if (!user_name) return;

  if (parseInt(amount) === NaN || amount === undefined) {
    amount = 1;
  } else {
    amount = parseInt(amount);
  }

  if (userLevel(tags) < 3) {
    client.say(
      channel,
      `@${user_name}, you must be at least a mod to pick a user from the queue.`
    );
    return;
  }

  const queue = await prisma.queue
    .findUnique({
      where: {
        id: channelID,
      },
      include: {
        User: true,
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!queue) {
    client.say(channel, `@${user_name}, failed to pick a user.`);
    return;
  }

  if (queue.User.length === 0) {
    client.say(channel, `@${user_name}, the queue is empty.`);
    return;
  }

  if (amount > queue.User.length) {
    client.say(
      channel,
      `@${user_name}, there are not enough users in the queue to pick.`
    );
    return;
  }

  let picked = `@${user_name}, the picked user(s) is/are: `;
  let pickedUsers: string[] = [];
  let users = [...queue.User];
  const pickedUsersID: string[] = [];
  for (let i = 0; i < amount; i++) {
    let pickeruser = users.shift();
    if (!pickeruser) return;
    pickedUsersID.push(pickeruser.id);
    pickedUsers.push(`${i + 1}. ${pickeruser.Name}`);
  }

  const newQueue = await prisma.queue
    .update({
      where: {
        id: channelID,
      },
      data: {
        User: {
          deleteMany: {
            id: {
              in: pickedUsersID,
            },
          },
        },
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!newQueue) {
    client.say(channel, `@${user_name}, failed to pick a user.`);
    return;
  }

  picked = picked + pickedUsers.join(", ");
  client.say(channel, picked);
};

const rand = async (channel: string, tags: any, message: string) => {
  const channelID = tags["room-id"];

  const user_name = tags["display-name"];

  let amount: string | number = message.split(" ")[1];

  if (!user_name) return;

  if (parseInt(amount) === NaN || amount === undefined) {
    amount = 1;
  } else {
    amount = parseInt(amount);
  }

  if (userLevel(tags) < 3) {
    client.say(
      channel,
      `@${user_name}, you must be at least a mod to pick a user from the queue.`
    );
    return;
  }

  const queue = await prisma.queue
    .findUnique({
      where: {
        id: channelID,
      },
      include: {
        User: true,
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!queue) {
    client.say(channel, `@${user_name}, failed to pick a user.`);
    return;
  }

  if (queue.User.length === 0) {
    client.say(channel, `@${user_name}, the queue is empty.`);
    return;
  }

  if (amount > queue.User.length) {
    client.say(
      channel,
      `@${user_name}, there are not enough users in the queue to pick.`
    );
    return;
  }

  let picked = `@${user_name}, the picked user(s) is/are: `;
  let pickedUsers: string[] = [];
  let users = queue.User.sort((a, b) => 0.5 - Math.random());
  const pickedUsersID: string[] = [];
  for (let i = 0; i < amount; i++) {
    let pickeruser = users.shift();
    if (!pickeruser) return;
    pickedUsersID.push(pickeruser.id);
    pickedUsers.push(`${i + 1}. ${pickeruser.Name}`);
  }

  const newQueue = await prisma.queue
    .update({
      where: {
        id: channelID,
      },
      data: {
        User: {
          deleteMany: {
            id: {
              in: pickedUsersID,
            },
          },
        },
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!newQueue) {
    client.say(channel, `@${user_name}, failed to pick a user.`);
    return;
  }

  picked = picked + pickedUsers.join(", ");
  client.say(channel, picked);
};

const remove = async (channel: string, tags: any, message: string) => {
  const channelID = tags["room-id"];

  const user_name = tags["display-name"];

  if (!user_name) return;

  if (userLevel(tags) < 3) {
    client.say(
      channel,
      `@${user_name}, you must be at least a mod to remove a user from the queue.`
    );
    return;
  }

  const queue = await prisma.queue
    .findUnique({
      where: {
        id: channelID,
      },
      include: {
        User: true,
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!queue) {
    client.say(channel, `@${user_name}, failed to remove a user.`);
    return;
  }

  if (queue.User.length === 0) {
    client.say(channel, `@${user_name}, the queue is empty.`);
    return;
  }

  const userToRemove = message.split(" ")[1];

  if (userToRemove === undefined) {
    client.say(channel, `@${user_name}, you must specify a user to remove.`);
    return;
  }

  if (!queue.User.find((user) => user.Name === userToRemove.replace("@", ""))) {
    client.say(
      channel,
      `@${user_name}, the user ${userToRemove} is not in the queue.`
    );
    return;
  }

  const newQueue = await prisma.queue
    .update({
      where: {
        id: channelID,
      },
      data: {
        User: {
          deleteMany: {
            Name: userToRemove.replace("@", ""),
          },
        },
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!newQueue) {
    client.say(channel, `@${user_name}, failed to remove a user.`);
    return;
  }

  client.say(
    channel,
    `@${user_name}, ${userToRemove.replace(
      "@",
      ""
    )} has been removed from the queue.`
  );
};

const blacklist = async (channel: string, tags: any, message: string) => {
  const channelID = tags["room-id"];

  const user_name = tags["display-name"];

  if (!user_name) return;

  if (userLevel(tags) < 3) {
    client.say(
      channel,
      `@${user_name}, you must be at least a mod to add a blacklist to the queue.`
    );
    return;
  }

  const queue = await prisma.queue
    .findUnique({
      where: {
        id: channelID,
      },
      include: {
        User: true,
        Blacklist: true,
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!queue) {
    client.say(channel, `@${user_name}, failed to blacklist a user.`);
    return;
  }

  const userToBlacklist = message.split(" ")[1];

  if (userToBlacklist === undefined) {
    client.say(channel, `@${user_name}, you must specify a user to blacklist.`);
    return;
  }

  if (
    queue.Blacklist.find(
      (user) => user.Name === userToBlacklist.replace("@", "")
    )
  ) {
    client.say(
      channel,
      `@${user_name}, the user ${userToBlacklist} is already blacklisted.`
    );
    return;
  }

  const newQueue = await prisma.queue
    .update({
      where: {
        id: channelID,
      },
      data: {
        Blacklist: {
          create: {
            Name: userToBlacklist.replace("@", ""),
          },
        },
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!newQueue) {
    client.say(channel, `@${user_name}, failed to blacklist a user.`);
    return;
  }

  client.say(
    channel,
    `@${user_name}, ${userToBlacklist.replace(
      "@",
      ""
    )} has been blacklisted from the queue.`
  );
};

const unblacklist = async (channel: string, tags: any, message: string) => {
  const channelID = tags["room-id"];

  const user_name = tags["display-name"];

  if (!user_name) return;

  if (userLevel(tags) < 3) {
    client.say(
      channel,
      `@${user_name}, you must be at least a mod to remove a blacklist from the queue.`
    );
    return;
  }

  const queue = await prisma.queue
    .findUnique({
      where: {
        id: channelID,
      },
      include: {
        User: true,
        Blacklist: true,
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!queue) {
    client.say(channel, `@${user_name}, failed to unblacklist a user.`);
    return;
  }

  const userToUnblacklist = message.split(" ")[1];

  if (userToUnblacklist === undefined) {
    client.say(
      channel,
      `@${user_name}, you must specify a user to unblacklist.`
    );
    return;
  }

  if (
    !queue.Blacklist.find(
      (user) => user.Name === userToUnblacklist.replace("@", "")
    )
  ) {
    client.say(
      channel,
      `@${user_name}, the user ${userToUnblacklist} is not blacklisted.`
    );
    return;
  }

  const newQueue = await prisma.queue
    .update({
      where: {
        id: channelID,
      },
      data: {
        Blacklist: {
          deleteMany: {
            Name: userToUnblacklist.replace("@", ""),
          },
        },
      },
    })
    .catch((err) => {
      console.log(err);
      return;
    });

  if (!newQueue) {
    client.say(channel, `@${user_name}, failed to unblacklist a user.`);
    return;
  }

  client.say(
    channel,
    `@${user_name}, ${userToUnblacklist.replace(
      "@",
      ""
    )} has been unblacklisted from the queue.`
  );
};

const qhelp = async (channel: string, tags: any, message: string) => {
  const user_name = tags["display-name"];

  const commandQuery = message.split(" ")[1];

  if (!user_name) return;

  if (commandQuery === undefined) {
    if (userLevel(tags) < 3) {
      client.say(
        channel,
        `@${user_name}, commands: !qhelp, !queue, !join, !leave, !length, !level, !list`
      );
      return;
    }

    return client.say(
      channel,
      `@${user_name}, commands: !qhelp, !queue, !join, !leave, !length, !limit !level, !list, !blacklist, !unblacklist, !remove, !clear, !open, !close`
    );
  }

  switch (commandQuery) {
    case "queue":
      client.say(
        channel,
        `@${user_name}, !queue - shows the current queue information.`
      );
      break;
    case "join":
      client.say(channel, `@${user_name}, !join - joins the queue.`);
      break;
    case "leave":
      client.say(channel, `@${user_name}, !leave - leaves the queue.`);
      break;
    case "length":
      client.say(
        channel,
        `@${user_name}, !length - shows the length of the queue.`
      );
      break;
    case "limit":
      client.say(
        channel,
        `@${user_name}, !limit - sets the user limit of the queue. Can only be used by mods. If set to 0, there is no limit. (Example: !limit <number>)`
      );
      break;
    case "level":
      client.say(
        channel,
        `@${user_name}, !level - shows the level of the queue. Can set the level with !level <level> (Viewer, Subscriber, VIP, Moderator).`
      );
      break;
    case "list":
      client.say(
        channel,
        `@${user_name}, !list - shows the list of users in the queue.`
      );
      break;
    case "blacklist":
      client.say(
        channel,
        `@${user_name}, !blacklist <user> - blacklists a user from the queue. Can only be used by mods. (Example: !blacklist @user)`
      );
      break;
    case "unblacklist":
      client.say(
        channel,
        `@${user_name}, !unblacklist <user> - unblacklists a user from the queue. Can only be used by mods. (Example: !unblacklist @user)`
      );
      break;
    case "remove":
      client.say(
        channel,
        `@${user_name}, !remove <user> - removes a user from the queue. Can only be used by mods. (Example: !remove @user)`
      );
      break;
    case "clear":
      client.say(
        channel,
        `@${user_name}, !clear - clears the queue. Can only be used by mods.`
      );
      break;
    case "open":
      client.say(
        channel,
        `@${user_name}, !open - opens the queue. Can only be used by mods. If not arguments are given the last queue state will be used. (Example: !open <level> <user limit>)`
      );
      break;
    case "close":
      client.say(
        channel,
        `@${user_name}, !close - closes the queue. Can only be used by mods.`
      );
      break;
    default:
      client.say(
        channel,
        `@${user_name}, commands: !qhelp, !queue, !join, !leave, !length, !level, !list`
      );
      break;
  }
};

client.connect().catch(console.error);
client.on("message", async (channel, tags, message, self) => {
  if (self) return;
  if (!message.startsWith("!")) return;
  message = message.toLowerCase();
  const command = message.split(" ")[0];

  if (tags["room-id"] === "834942090") {
    if (command === "!help") {
      return help(channel, tags, message);
    }
  }

  try {
    switch (command) {
      case "!joinchannel":
        joinchannel(channel, tags, message);
        break;
      case "!leavechannel":
        leavechannel(channel, tags, message);
        break;
      case "!manualjoin":
        manualJoin(channel, tags, message);
        break;
      case "!help":
        qhelp(channel, tags, message);
        break;
      case "!queue":
        queue(channel, tags, message);
        break;
      case "!join":
        join(channel, tags, message);
        break;
      case "!leave":
        leave(channel, tags, message);
        break;
      case "!open":
        openQueue(channel, tags, message);
        break;
      case "!close":
        closeQueue(channel, tags, message);
        break;
      case "!clear":
        clearQueue(channel, tags, message);
        break;
      case "!length":
        queueLength(channel, tags, message);
        break;
      case "!level":
        queueLevel(channel, tags, message);
        break;
      case "!list":
        list(channel, tags, message);
        break;
      case "!limit":
        limit(channel, tags, message);
        break;
      case "!pick":
        pick(channel, tags, message);
        break;
      case "!rand":
        rand(channel, tags, message);
        break;
      case "!remove":
        remove(channel, tags, message);
        break;
      case "!blacklist":
        blacklist(channel, tags, message);
        break;
      case "!unblacklist":
        unblacklist(channel, tags, message);
        break;
      case "!qhelp":
        qhelp(channel, tags, message);
      default:
        break;
    }
  } catch (error) {
    console.error(error);
  }
});
