ALTER TABLE buildings ADD CONSTRAINT buildings_property_identifier_unique
  UNIQUE (property_id, building_identifier);
ALTER TABLE units ADD CONSTRAINT units_building_number_unique
  UNIQUE (building_id, unit_number);
