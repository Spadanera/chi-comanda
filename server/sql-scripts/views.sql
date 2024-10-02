CREATE VIEW AvailableTables AS
WITH available_tables AS (
	SELECT tables.id, tables.name, table_master_table.master_table_id, tables.event_id
	FROM tables
	INNER JOIN table_master_table ON tables.id = table_master_table.table_id
	WHERE STATUS = 'ACTIVE'
)

SELECT 
available_tables.id table_id, 
available_tables.name table_name, 
master_tables.id master_table_id, 
master_tables.name master_table_name, 
master_tables.default_seats,
available_tables.event_id
FROM available_tables
RIGHT JOIN master_tables ON available_tables.master_table_id = master_tables.id;