import mongoose, { Schema } from 'mongoose';

// Singleton document — one record holds the global top-10 HoF entries
const GlobalHoFSchema = new Schema({
  entries: Schema.Types.Mixed,
});

export default mongoose.model('GlobalHoF', GlobalHoFSchema);
