declare global {
  namespace NodeJS {
    interface ProcessEnv {
      TOKEN: string;
      APPLICATION_ID: string;
      GOOGLE_TYPE: string;
      GOOGLE_PROJECT_ID: string;
      GOOGLE_PRIVATE_KEY_ID: string;
      GOOGLE_PRIVATE_KEY: string;
      GOOGLE_CLIENT_EMAIL: string;
      GOOGLE_CLIENT_ID: string;
      GOOGLE_AUTH_URI: string;
      GOOGLE_TOKEN_URI: string;
      GOOGLE_AUTH_PROVIDER_CERT_URL: string;
      GOOGLE_CLIENT_CERT_URL: string;
      GOOGLE_UNIVERSE_DOMAIN: string;
      REGISTRATION_FORM_ID: string;
      DATABASE_URI: string;
      BACKEND_URL: string;
      BACKEND_API_KEY: string;
    }
  }
}

export {};
