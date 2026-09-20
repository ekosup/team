-- modules was a JSON array of plain name strings; move to an array of {name, description} objects
-- so each module can carry a short description shown on the project view.
UPDATE boards
SET modules = (
  SELECT COALESCE(json_group_array(json_object('name', value, 'description', '')), '[]')
  FROM json_each(modules)
)
WHERE modules IS NOT NULL AND modules != '[]';
