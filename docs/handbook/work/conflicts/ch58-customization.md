# Conflicts: ch58-customization

## Oddities
- Sidebar label for the theme screen is Theme; page title is Branding & theme.
- Browser local storage keys of the theme cache and a Redis channel name carry the former product name (not named in the chapter).
## Security
- File upload: the API accepts up to 15 MB while the theme screen limits to 2 MB; content type is not restricted in the controller.
