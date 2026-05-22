export interface Project {
  id: number;
  name: string;
  cover_url: string | null;
  product_title: string | null;
  product_description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  name: string;
  product_title?: string;
  product_description?: string;
}
