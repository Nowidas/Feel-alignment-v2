from flask import Flask, jsonify
from flask_cors import CORS
import gspread
from oauth2client.service_account import ServiceAccountCredentials

app = Flask(__name__)
CORS(app)


# Google Sheets API setup
def get_gspread_client():
    # Define the scope for the Google Sheets API
    scope = [
        "https://spreadsheets.google.com/feeds",
        "https://www.googleapis.com/auth/drive",
    ]

    # Load credentials from the JSON key file
    creds = ServiceAccountCredentials.from_json_keyfile_name(
        "service-account-backend.json", scope
    )

    # Authorize and create a gspread client
    client = gspread.authorize(creds)
    return client


# Function to fetch quotes from Google Sheets
def get_quotes_from_sheet():
    client = get_gspread_client()

    # Open the Google Sheet using its Sheet ID
    sheet_id = "1gk914WMZp1mHDRoQWjItrPIBDMhTeIzltYaPEhJpBd0"  # Replace with your actual Sheet ID

    # Access the first sheet by its index (0)
    sheet = client.open_by_key(sheet_id).worksheet("quotes")

    # Get all records (returns as a list of dictionaries)
    quotes_list = sheet.get_all_records()

    return quotes_list


# API route to get all quotes
@app.route("/quotes", methods=["GET"])
def get_quotes():
    try:
        # Fetch quotes from Google Sheets
        quotes = get_quotes_from_sheet()

        # Return the quotes as a JSON response
        return jsonify(quotes), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
