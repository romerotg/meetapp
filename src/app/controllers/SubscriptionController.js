import * as Yup from 'yup';
import { isBefore } from 'date-fns';
import { Op } from 'sequelize';
import Subscription from '../models/Subscription';
import Meetup from '../models/Meetup';
import User from '../models/User';
import Queue from '../../lib/Queue';
import SubscriptionMail from '../jobs/SubscriptionMail';

class SubscriptionController {
  async index(req, res) {
    const subscriptions = await Subscription.findAll({
      where: {
        user_id: req.userId,
      },
      include: [
        {
          model: Meetup,
          as: 'meetup',
          where: {
            date: {
              [Op.gt]: new Date(),
            },
          },
        },
      ],
      sort: {
        createdAt: 'asc',
      },
    });

    return res.json(subscriptions);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      meetup_id: Yup.number().required(),
    });

    if (!(await schema.isValid(req.body)))
      return res.status(400).json({ error: 'Validation fails.' });

    const { meetup_id } = req.body;
    // check if meetup exists
    const meetup = await Meetup.findByPk(meetup_id, {
      include: [
        {
          model: User,
          as: 'organizer',
          attributes: ['name', 'email'],
        },
      ],
    });
    if (!meetup)
      return res.status(400).json({ error: 'Meetup does not exist.' });

    // check if the user is not organizing the meetup
    if (meetup.user_id === req.userId)
      return res.status(400).json({
        error: 'You can not subscribe to events that you are organizing.',
      });

    // check if the meetup already happened
    if (isBefore(meetup.getDataValue, new Date()))
      return res.status(400).json({
        error: 'You can not subscribe yo an event that has already happened.',
      });

    // check if user is already subscribed
    const subscriptionExists = await Subscription.findOne({
      where: {
        user_id: req.userId,
        meetup_id,
      },
    });
    if (subscriptionExists)
      return res.status(400).json({
        error: 'You can not subscribe to the same meetup more than once.',
      });

    // check if user is subscribed in another meetup at the same time
    const subscribedAtTheSameTime = await Subscription.findOne({
      where: {
        user_id: req.userId,
      },
      include: [
        {
          model: Meetup,
          as: 'meetup',
          where: {
            date: meetup.date,
          },
        },
      ],
    });
    if (subscribedAtTheSameTime)
      return res.status(400).json({
        error:
          'You can not subscribe to two events that happen at the same time.',
      });

    const subscription = await Subscription.create({
      ...req.body,
      user_id: req.userId,
    });

    // load logged user to send the email
    const user = await User.findByPk(req.userId, {
      attributes: ['name', 'email'],
    });

    // Send subscription mail to the organizer
    Queue.add(SubscriptionMail.key, {
      meetup,
      user,
    });

    return res.json(subscription);
  }
}

export default new SubscriptionController();
