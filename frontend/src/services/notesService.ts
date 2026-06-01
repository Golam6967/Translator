import api from "../lib/api";

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteData {
  title: string;
  content: string;
  tags?: string[];
  language?: string;
}

export interface UpdateNoteData {
  title?: string;
  content?: string;
  tags?: string[];
  language?: string;
}

const notesService = {
  // Get all notes with pagination
  getNotes: async (page: number = 1, limit: number = 10) => {
    const response = await api.get("/api/notes", {
      params: { page, limit },
    });
    return response.data;
  },

  // Get a single note
  getNote: async (id: string) => {
    const response = await api.get(`/api/notes/${id}`);
    return response.data;
  },

  // Create a new note
  createNote: async (data: CreateNoteData) => {
    const response = await api.post("/api/notes", data);
    return response.data;
  },

  // Update entire note (PUT)
  updateNote: async (id: string, data: CreateNoteData) => {
    const response = await api.put(`/api/notes/${id}`, data);
    return response.data;
  },

  // Partial update note (PATCH)
  partialUpdateNote: async (id: string, data: UpdateNoteData) => {
    const response = await api.patch(`/api/notes/${id}`, data);
    return response.data;
  },

  // Delete a note
  deleteNote: async (id: string) => {
    const response = await api.delete(`/api/notes/${id}`);
    return response.data;
  },
};

export default notesService;
