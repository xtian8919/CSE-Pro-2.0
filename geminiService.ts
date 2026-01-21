import { GoogleGenAI, Type } from "@google/genai";
import { Category, Question, ReviewerNote } from "./types.ts";

// Function to get AI instance safely, ensuring process.env is accessed at runtime
const getAI = () => {
  if (!process.env.API_KEY) {
    console.warn("API_KEY is not defined in the environment.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const questionSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      category: { type: Type.STRING, description: "Category: Verbal Ability, Analytical Ability, Numerical Ability, or General Information" },
      text: { type: Type.STRING, description: "The full text of the question" },
      options: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "List of exactly 4 plausible options" 
      },
      correctAnswer: { type: Type.INTEGER, description: "Zero-based index of the correct option (0-3)" },
      explanation: { type: Type.STRING, description: "Detailed explanation of why the answer is correct" }
    },
    required: ["category", "text", "options", "correctAnswer", "explanation"],
  },
};

const noteSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      category: { type: Type.STRING },
      title: { type: Type.STRING },
      content: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Key concepts or bullet points" }
    },
    required: ["category", "title", "content"]
  }
};

export const fetchQuestions = async (count: number = 170, specificCategory?: Category): Promise<Question[]> => {
  const ai = getAI();
  let prompt = "";
  if (specificCategory) {
    prompt = `
      Generate ${count} high-quality practice questions for the Philippine Civil Service Professional Examination (2026 Edition).
      Category: ${specificCategory}.
      
      Technical Requirements:
      - Language: English.
      - Quality: Challenging, Professional Civil Service standard.
      - Output: A single JSON array containing all items.
    `;
  } else {
    prompt = `
      Generate a full-length Mock Philippine Civil Service Professional Examination (2026 Edition).
      Return ${count} items.
      
      Required Structure:
      - Numerical Ability
      - Analytical Ability
      - Verbal Ability
      - General Information
      
      Technical Requirements:
      - Language: English.
      - Quality: Challenging, Professional Civil Service standard.
    `;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: questionSchema,
        temperature: 0.7,
      },
    });

    const text = response.text || "[]";
    const data = JSON.parse(text.trim()) as any[];
    
    return data.map((q, idx) => {
      let category = specificCategory || Category.GENERAL_INFO;
      if (!specificCategory) {
        const lower = (q.category || "").toLowerCase();
        if (lower.includes("numerical")) category = Category.NUMERICAL;
        else if (lower.includes("analytical")) category = Category.ANALYTICAL;
        else if (lower.includes("verbal")) category = Category.VERBAL;
        else if (lower.includes("general")) category = Category.GENERAL_INFO;
      }

      return {
        ...q,
        id: `q-${idx}-${Date.now()}`,
        category
      };
    });
  } catch (error) {
    console.error("Error generating questions:", error);
    throw error;
  }
};

export const fetchReviewerNotes = async (): Promise<ReviewerNote[]> => {
  const ai = getAI();
  const prompt = `
    Create a comprehensive study guide for the 2026 Philippine Civil Service Professional Examination.
    Provide summary notes for each of the 4 categories: Numerical, Analytical, Verbal, and General Information.
    Focus on RA 6713, Constitution, and core math/logic formulas.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: noteSchema,
        temperature: 0.5,
      },
    });

    const text = response.text || "[]";
    return JSON.parse(text.trim());
  } catch (error) {
    console.error("Error generating reviewer notes:", error);
    throw error;
  }
};