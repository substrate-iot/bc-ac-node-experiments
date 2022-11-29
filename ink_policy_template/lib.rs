#![cfg_attr(not(feature = "std"), no_std)]

use ink_env::Environment;
use ink_lang as ink;
use ink_prelude::{
  string::{String, ToString},
  vec::Vec,
};

pub mod configuration {
  use super::*;

  pub const MAX_STRING_LENGTH: usize = 64; // limitation of both key and value of attributes.

  type DefaultAccountId = <ink_env::DefaultEnvironment as Environment>::AccountId;
  type AttrKeyFix = [u8; MAX_STRING_LENGTH];

  #[ink::chain_extension]
  pub trait AbacExtension {
    type ErrorCode = ExtensionErrorCode;

    #[ink(extension = 0x0001, handle_status = true, returns_result = true)]
    fn read_attribute_value(identity: DefaultAccountId, key: AttrKeyFix) -> Result<Vec<u8>>;

    #[ink(extension = 0x0002, handle_status = true, returns_result = true)]
    fn check_endorsement(identity: DefaultAccountId, key: AttrKeyFix, endorsers: Vec<DefaultAccountId>) -> Result<bool>;
  }

  #[derive(Debug, Copy, Clone, PartialEq, Eq, scale::Encode, scale::Decode)]
  #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
  pub enum ExtensionErrorCode {
    InvalidInput,
  }

  pub type Result<T> = core::result::Result<T, ExtensionErrorCode>;

  impl From<scale::Error> for ExtensionErrorCode {
    fn from(_: scale::Error) -> Self {
      panic!("encountered unexpected invalid SCALE encoding")
    }
  }

  impl ink_env::chain_extension::FromStatusCode for ExtensionErrorCode {
    fn from_status_code(status_code: u32) -> core::result::Result<(), Self> {
      match status_code {
        0 => Ok(()),
        1 => Err(Self::InvalidInput),
        _ => panic!("encountered unknown status code"),
      }
    }
  }

  #[derive(Debug, Clone, PartialEq, Eq)]
  #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
  pub enum AbacEnvironment {}

  impl Environment for AbacEnvironment {
    const MAX_EVENT_TOPICS: usize = <ink_env::DefaultEnvironment as Environment>::MAX_EVENT_TOPICS;

    type AccountId = <ink_env::DefaultEnvironment as Environment>::AccountId;
    type Balance = <ink_env::DefaultEnvironment as Environment>::Balance;
    type Hash = <ink_env::DefaultEnvironment as Environment>::Hash;
    type BlockNumber = <ink_env::DefaultEnvironment as Environment>::BlockNumber;
    type Timestamp = <ink_env::DefaultEnvironment as Environment>::Timestamp;

    type ChainExtension = AbacExtension;
  }
}

#[derive(Debug, Clone, PartialEq, Eq, scale::Encode, scale::Decode)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub struct Attribute {
  name: String,
  value: String,
}

#[ink::contract(env = crate::configuration::AbacEnvironment)]
mod policy_template {
  use super::*;

  /// The storage of this policy contract.
  #[ink(storage)]
  pub struct PolicyTemplate {
    /// Stores identities who are trust for this policy.
    endorsers: Vec<AccountId>,
  }

  impl PolicyTemplate {
    fn get_env_attr_value(&self, env_attrs: &Vec<Attribute>, key: String) -> Option<String> {
      match env_attrs.iter().find(|ea| (**ea).name == key) {
        Some(attr) => Some((*attr).value.clone()),
        None => None,
      }
    }

    fn get_attribute_value(&self, identity: AccountId, key: String) -> Option<String> {
      if key.len() > configuration::MAX_STRING_LENGTH {
        return None;
      }

      // Convert the key of String to the key of AttrKeyFix (fixed-length).
      let mut key_fix = [0u8; configuration::MAX_STRING_LENGTH];
      key_fix[..key.len()].copy_from_slice(key.as_bytes());

      let result = self.env().extension().read_attribute_value(identity, key_fix);

      match result {
        Ok(attr_value) => Some(String::from_utf8(attr_value).unwrap_or_default()),
        _ => None,
      }
    }

    fn has_valid_endorsement(&self, identity: AccountId, key: String) -> bool {
      if key.len() > configuration::MAX_STRING_LENGTH {
        return false;
      }

      // Convert the key of String to the key of AttrKeyFix (fixed-length).
      let mut key_fix = [0u8; configuration::MAX_STRING_LENGTH];
      key_fix[..key.len()].copy_from_slice(key.as_bytes());

      let result = self.env().extension().check_endorsement(identity, key_fix, self.endorsers.clone());

      match result {
        Ok(is_valid) => is_valid,
        _ => false,
      }
    }

    /// Constructor that initializes this policy with the initial endorsers.
    #[ink(constructor)]
    pub fn new(initial_endorsers: Vec<AccountId>) -> Self {
      Self { endorsers: initial_endorsers }
    }

    /// Constructor that initializes this policy with empty endorser.
    #[ink(constructor)]
    pub fn default() -> Self {
      Self::new(Default::default())
    }

    #[ink(message)]
    pub fn get_endorsers(&self) -> Vec<AccountId> {
      self.endorsers.clone()
    }

    /// Check if the subject has which access permissions to the object.
    #[ink(message)]
    pub fn check_access(&self, subject: AccountId, object: AccountId, environment_attributes: Vec<Attribute>) -> Vec<String> {
      let mut decisions = Vec::<String>::new();

      /* ---------------------------------------------- */
      /* Beginning of AC policy logic defined by author */
      /* ---------------------------------------------- */

      // Location restriction
      let subject_location = self.get_attribute_value(subject, "Location".to_string()).unwrap_or_default();
      let object_location = self.get_attribute_value(object, "Location".to_string()).unwrap_or_default();
      let subject_endorsed = self.has_valid_endorsement(subject, "Location".to_string());

      if subject_location != "" && subject_endorsed && (subject_location == object_location) {
        decisions.push("allow access to resource 1".to_string());
      } else {
        decisions.push("deny access to resource 1".to_string());
      }

      // Time restriction
      let begin_hour = 08;
      let end_hour = 20;
      let environment_time = self.get_env_attr_value(&environment_attributes, "CurrentHour".to_string()).unwrap();
      let current_hour = environment_time.parse::<i32>().unwrap_or(-1);

      if current_hour != -1 && (begin_hour <= current_hour && current_hour < end_hour) {
        decisions.push("allow access to resource 2".to_string());
      } else {
        decisions.push("deny access to resource 2".to_string());
      }

      /* ---------------------------------------- */
      /* End of AC policy logic defined by author */
      /* ---------------------------------------- */

      decisions
    }
  }

  /// Unit tests in Rust are normally defined within such a `#[cfg(test)]`
  /// module and test functions are marked with a `#[test]` attribute.
  /// The below code is technically just normal Rust code.
  #[cfg(test)]
  mod tests {
    /// Imports all the definitions from the outer scope so we can use them here.
    use super::*;

    /// Imports `ink_lang` so we can use `#[ink::test]`.
    use ink_lang as ink;
  }
}
