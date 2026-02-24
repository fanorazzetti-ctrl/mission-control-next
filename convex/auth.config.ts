export default {
  providers: [
    {
      domain: process.env.AUTH_DOMAIN,
      applicationID: process.env.AUTH_APPLICATION_ID,
    },
  ],
};
