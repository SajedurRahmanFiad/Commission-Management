
import { GoogleGenAI } from "@google/genai";

export const generateApprovalEmail = async (customerEmail: string, amount: number) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a professional and friendly confirmation email for a customer with email ${customerEmail} who just successfully paid ${amount} BDT via mobile banking. Keep it short and supportive.`,
      config: {
        systemInstruction: "You are an automated customer service agent for a premium digital service provider.",
      }
    });
    return response.text || "Your payment has been successfully approved. Thank you for your business!";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return `Dear Customer, your payment of ${amount} BDT has been successfully verified and approved. Thank you!`;
  }
};
