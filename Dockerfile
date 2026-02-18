FROM node:18-slim

WORKDIR /usr/src/app

# מעתיק קבצי חבילות משורש הפרויקט (אם יש) או מהתיקייה
COPY package*.json ./

# התקנת תלויות
RUN npm install --only=production

# העתקת כל הקבצים (כולל תיקיית server)
COPY . .

# הגדרת משתנה סביבה לפורט (Cloud Run דורש זאת)
ENV PORT=8080
EXPOSE 8080

# הרצה של הקובץ הספציפי שלך
CMD [ "node", "server/index.js" ]