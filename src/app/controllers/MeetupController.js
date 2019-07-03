import * as Yup from 'yup';
import { parseISO, isBefore } from 'date-fns';

import Meetup from '../models/Meetup';
import File from '../models/File';

class MeetupController {
  async index(req, res) {
    const meetups = await Meetup.findAll({ where: { user_id: req.userId } });
    return res.json(meetups);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      title: Yup.string().required(),
      description: Yup.string().required(),
      location: Yup.string().required(),
      date: Yup.date().required(),
      banner_id: Yup.number().required(),
    });

    if (!(await schema.isValid(req.body)))
      return res.status(400).json({ error: 'Validation fails' });

    const { banner_id, date } = req.body;

    // check if banner exists
    const banner = await File.findByPk(banner_id);
    if (!banner)
      return res.status(400).json({ error: 'Banner does not exist' });

    // check if date has passed
    if (isBefore(parseISO(date), new Date()))
      return res
        .status(400)
        .json({ error: 'Can not create meetups with past dates' });

    const meetup = await Meetup.create({ ...req.body, user_id: req.userId });

    return res.json(meetup);
  }

  async update(req, res) {
    const schema = Yup.object().shape({
      title: Yup.string(),
      description: Yup.string(),
      location: Yup.string(),
      date: Yup.date(),
      banner_id: Yup.number(),
    });

    if (!(await schema.isValid(req.body)))
      return res.status(400).json({ error: 'Validation fails' });

    // check if meetup exists
    const meetup = await Meetup.findByPk(req.params.id);
    if (!meetup) return res.status(404).json({ error: 'Meetup not found.' });

    // check if logged user is the creator of the meetup
    if (meetup.user_id !== req.userId)
      return res
        .status(401)
        .json({ error: 'You can only update meetups that you have created.' });

    // check if the meetup didn't happen yet
    if (isBefore(meetup.date, new Date()))
      return res
        .status(400)
        .json({ error: 'You can not update meetups that already happened.' });

    const updatedMeetup = await meetup.update(req.body);

    return res.json(updatedMeetup);
  }

  async delete(req, res) {
    // check if meetup exist
    const meetup = await Meetup.findByPk(req.params.id);
    if (!meetup) return res.status(404).json({ error: 'Meetup not found.' });

    // check if logged user is the creator of the meetup
    if (meetup.user_id !== req.userId)
      return res
        .status(401)
        .json({ error: 'You can only delete meetups that you have created' });

    // check if the meetup didn't happen yet
    if (isBefore(meetup.date, new Date()))
      return res
        .status(400)
        .json({ error: 'You can not delete meetups that already happened.' });

    await meetup.destroy();

    return res.json();
  }
}

export default new MeetupController();
