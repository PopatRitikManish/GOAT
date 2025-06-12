import User from "../models/userModel.js";
import Questions from "../models/questionsModel.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const createQuestion = async (req, res) => {
     try {
          const { questionseBy, name, link, questionTag } = req.body;
          if (!questionseBy || !name || !link || !questionTag) {
               return res.status(400).json({ error: "All fields are required" });
          }

          if (!["Arrays", "Linked List", "Greedy Algorithm", "Recursion", "Backtracking", "Binary Search", "Heaps", "Stack and Queue", "String", "Tree", "Graph", "Dynamic Programming", "Trie", "Segment Tree", "Miscellaneous"].includes(questionTag)) {
               return res.status(400).json({ error: "Invalid question tag" });
          }

          const user = await User.findById(questionseBy);
          if (!user) {
               return res.status(404).json({ error: "User not found" });
          }

          if (user._id.toString() !== req.user._id.toString()) {
               return res.status(401).json({ error: "Unauthorized to create question" });
          }

          const newQuestion = new Questions({ questionseBy, name, link, questionTag });
          await newQuestion.save();

          res.status(201).json(newQuestion);

     } catch (error) {
          res.status(500).json({ error: error.message });
     }
}


const deleteQuestion = async (req, res) => {
     try {
          const question = await Questions.findById(req.params.id);
          if (!question) {
               return res.status(404).json({ error: "Question not found" });
          }

          if (question.questionseBy.toString() !== req.user._id.toString()) {
               return res.status(401).json({ error: "Unauthorized to delete question" });
          }

          await Questions.findByIdAndDelete(req.params.id);

          res.status(200).json({ message: "Question deleted successfully" });
     } catch (err) {
          res.status(500).json({ error: err.message });
     }
};

const addNote = async (req, res) => {
     try {
          const { id } = req.params;
          const { notes } = req.body;

          if (!notes) {
               return res.status(400).json({ error: "Notes field is required" });
          }

          const question = await Questions.findById(id);

          if (!question) {
               return res.status(404).json({ error: "Question not found" });
          }

          if (question.questionseBy.toString() !== req.user._id.toString()) {
               return res.status(401).json({ error: "Unauthorized to add notes to this question" });
          }

          question.notes = notes;
          await question.save();

          res.status(200).json(question);
     } catch (error) {
          res.status(500).json({ error: error.message });
     }
};

const getUserQuestions = async (req, res) => {
     const { username } = req.params;
     try {
          const user = await User.findOne({ username });
          if (!user) {
               return res.status(404).json({ error: "User not found" });
          }
          const questions = await Questions.find({ questionseBy: user._id }).sort({ createdAt: -1 });
          res.status(200).json(questions);
     } catch (error) {

     }
};

const getQuestionTopics = async (req, res) => {
     try {
          const { username } = req.params;
          const user = await User.findOne({ username });
          if (!user) {
               return res.status(404).json({ error: "User not found" });
          }
          const questions = await Questions.find({ questionseBy: user._id });
          console.log(questions);
          const topicCounts = questions.reduce((acc, question) => {
               acc[question.questionTag] = (acc[question.questionTag] || 0) + 1;
               return acc;
          }, {});
          console.log(topicCounts);
          const topicCountsArray = Object.keys(topicCounts).map(topic => ({
               topic,
               count: topicCounts[topic]
          }));
          console.log(topicCountsArray);
          res.json(topicCountsArray);
     } catch (err) {
          res.status(500).json({ error: 'Server error' });
     }
};

const getGenNot = async (req, res) => {
     try {
          const { name, link } = req.body;

          const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

          const model = genAI.getGenerativeModel({ model: "gemini-pro" });

          const prompt = `
          this is question name: "${name}"
          and this is question link: "${link}"
          can you give me notes for this of approximately 100 words in just 5 sentences and in one paragraph only`;

          const generatedNotes = await model.generateContent(prompt);

          const genAiNot = generatedNotes.response.text();

          res.status(200).send({ notes: genAiNot });
     } catch (error) {
          res.status(500).json({ error: error.message });
     }
}

const getRec = async (req, res) => {
     try {
          const { username } = req.params;
          console.log(username);
          const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

          const model = genAI.getGenerativeModel({ model: "gemini-pro" });
          const user = await User.findOne({ username });
          if (!user) {
               return res.status(404).json({ error: "User not found" });
          }
          // Fetch all questions for the user
          const questions = await Questions.find({ questionseBy: user._id }).select('name link questionTag');

          if (questions.length === 0) {
               return res.status(404).json({ error: "No questions found for the user." });
          }

          // Create a prompt to send to the AI model with enhanced context
          // Group questions by topic for better context
          const questionsByTopic = questions.reduce((acc, q) => {
               acc[q.questionTag] = acc[q.questionTag] || [];
               acc[q.questionTag].push(q);
               return acc;
          }, {});

          // Analyze user's focus areas
          const topicFrequency = Object.entries(questionsByTopic)
               .map(([topic, qs]) => ({ topic, count: qs.length }))
               .sort((a, b) => b.count - a.count);

          const topFocusAreas = topicFrequency.slice(0, 3).map(t => t.topic);
          const lessExploredAreas = Object.keys(questionsByTopic)
               .filter(topic => !topFocusAreas.includes(topic))
               .slice(0, 2);

          const prompt = `
          As an expert DSA problem recommender, analyze the following context:

          User's solved questions by topic:
          ${Object.entries(questionsByTopic)
               .map(([topic, qs]) => `${topic}: ${qs.length} questions solved\n${qs.map(q => q.name).join(", ")}`)
               .join("\n\n")}

          Top focus areas: ${topFocusAreas.join(", ")}
          Less explored areas: ${lessExploredAreas.join(", ")}

          Based on this analysis:
          1. Suggest exactly 3 high-quality DSA questions that:
             - Build upon concepts from their top focus areas
             - Gradually introduce elements from less explored topics
             - Are not too similar to questions they've already solved
             - Provide a natural progression in difficulty

          Return only the names of the 3 questions, separated by '||'.
          The questions should be challenging but approachable given their practice history.
          `;

          console.log(prompt);

          const recommendations = await model.generateContent(prompt);

          const genRec = recommendations.response.text();
          console.log(genRec);
          // Send the recommendations as a response
          res.status(200).json(genRec);
     } catch (error) {
          res.status(500).json({ error: error.message });
     }
};

export { createQuestion, deleteQuestion, addNote, getUserQuestions, getGenNot, getQuestionTopics, getRec };